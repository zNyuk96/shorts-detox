package com.shortsdetox.appdetector.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.nio.ByteBuffer

class ShortsVpnService : VpnService() {

    companion object {
        const val ACTION_START = "com.shortsdetox.vpn.START"
        const val ACTION_STOP = "com.shortsdetox.vpn.STOP"
        const val CHANNEL_ID = "shorts_vpn"
        const val NOTIF_ID = 7010
        const val TAG = "ShortsVPN"

        val BLOCKED_DOMAINS = setOf(
            "shorts.youtube.com",
            "www.youtube.com/shorts"
        )

        val BLOCKED_HOSTNAMES = setOf(
            "shorts.youtube.com"
        )

        @Volatile var isRunning = false
    }

    private var pfd: ParcelFileDescriptor? = null
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopVpn()
            return START_NOT_STICKY
        }
        startVpn()
        return START_STICKY
    }

    private fun startVpn() {
        try {
            createNotifChannel()
            startForeground(NOTIF_ID, buildNotification())

            val builder = Builder()
                .setSession("숏츠 디톡스 VPN")
                .addAddress("10.111.222.1", 32)
                .addDnsServer("10.111.222.2")
                .addRoute("0.0.0.0", 0)
                .setMtu(1500)

            pfd = builder.establish()
            isRunning = true
            Log.i(TAG, "VPN established")

            scope.launch { runDnsProxy() }
        } catch (e: Exception) {
            Log.e(TAG, "startVpn failed: ${e.message}")
            stopSelf()
        }
    }

    private fun stopVpn() {
        scope.cancel()
        pfd?.close()
        pfd = null
        isRunning = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        Log.i(TAG, "VPN stopped")
    }

    private suspend fun runDnsProxy() {
        val vpnInput = FileInputStream(pfd!!.fileDescriptor)
        val vpnOutput = FileOutputStream(pfd!!.fileDescriptor)
        val upstreamDns = InetAddress.getByName("8.8.8.8")
        val buf = ByteBuffer.allocate(32767)

        while (scope.isActive) {
            buf.clear()
            val len = vpnInput.channel.read(buf)
            if (len <= 0) continue

            buf.flip()
            val packet = ByteArray(len)
            buf.get(packet)

            if (!isDnsPacket(packet)) {
                vpnOutput.write(packet)
                continue
            }

            val domain = extractDnsQuery(packet) ?: run {
                forwardDns(packet, upstreamDns, vpnOutput)
                continue
            }

            if (BLOCKED_HOSTNAMES.any { blocked -> domain == blocked || domain.endsWith(".$blocked") }) {
                Log.d(TAG, "BLOCKED DNS: $domain")
                val nxdomain = buildNxdomainResponse(packet)
                vpnOutput.write(nxdomain)
            } else {
                forwardDns(packet, upstreamDns, vpnOutput)
            }
        }
    }

    private fun isDnsPacket(packet: ByteArray): Boolean {
        if (packet.size < 28) return false
        val protocol = packet[9].toInt() and 0xFF
        if (protocol != 17) return false  // UDP only
        val srcPort = ((packet[20].toInt() and 0xFF) shl 8) or (packet[21].toInt() and 0xFF)
        val dstPort = ((packet[22].toInt() and 0xFF) shl 8) or (packet[23].toInt() and 0xFF)
        return dstPort == 53 || srcPort == 53
    }

    private fun extractDnsQuery(packet: ByteArray): String? {
        return try {
            val udpPayloadOffset = 28
            if (packet.size <= udpPayloadOffset + 12) return null
            val dnsOffset = udpPayloadOffset
            val questionOffset = dnsOffset + 12
            val sb = StringBuilder()
            var i = questionOffset
            while (i < packet.size) {
                val labelLen = packet[i].toInt() and 0xFF
                if (labelLen == 0) break
                if (sb.isNotEmpty()) sb.append('.')
                val label = String(packet, i + 1, labelLen, Charsets.US_ASCII)
                sb.append(label)
                i += labelLen + 1
            }
            sb.toString().takeIf { it.isNotEmpty() }
        } catch (e: Exception) { null }
    }

    private fun buildNxdomainResponse(query: ByteArray): ByteArray {
        // Minimal NXDOMAIN response: copy query, set response bit + NXDOMAIN rcode
        val response = query.copyOf()
        val dnsOffset = 28
        if (response.size < dnsOffset + 4) return response
        response[dnsOffset + 2] = (response[dnsOffset + 2].toInt() or 0x80).toByte()  // QR=1 (response)
        response[dnsOffset + 3] = (response[dnsOffset + 3].toInt() or 0x03).toByte()  // RCODE=3 (NXDOMAIN)
        // Swap src/dst IP and ports in IP header
        swapIpAndPorts(response)
        recalculateChecksums(response)
        return response
    }

    private fun forwardDns(query: ByteArray, upstream: InetAddress, output: FileOutputStream) {
        try {
            val dnsOffset = 28
            val dnsLen = ((query[24].toInt() and 0xFF) shl 8) or (query[25].toInt() and 0xFF) - 8
            if (dnsLen <= 0 || query.size < dnsOffset + dnsLen) return

            val dnsPayload = ByteArray(dnsLen)
            System.arraycopy(query, dnsOffset, dnsPayload, 0, dnsLen)

            val socket = DatagramSocket()
            protect(socket)
            val sendPacket = DatagramPacket(dnsPayload, dnsLen, upstream, 53)
            socket.soTimeout = 3000
            socket.send(sendPacket)

            val responseBuffer = ByteArray(512)
            val responsePacket = DatagramPacket(responseBuffer, responseBuffer.size)
            socket.receive(responsePacket)
            socket.close()

            val response = buildIpUdpPacket(
                srcIp = upstream.address,
                dstIp = byteArrayOf(10, 111, 222, 1),
                srcPort = 53,
                dstPort = ((query[22].toInt() and 0xFF) shl 8) or (query[23].toInt() and 0xFF),
                payload = responsePacket.data.copyOf(responsePacket.length)
            )
            output.write(response)
        } catch (e: Exception) {
            Log.w(TAG, "forwardDns error: ${e.message}")
        }
    }

    private fun swapIpAndPorts(packet: ByteArray) {
        if (packet.size < 28) return
        // Swap src (12-15) and dst (16-19) IP
        for (i in 0..3) {
            val tmp = packet[12 + i]; packet[12 + i] = packet[16 + i]; packet[16 + i] = tmp
        }
        // Swap src (20-21) and dst (22-23) ports
        for (i in 0..1) {
            val tmp = packet[20 + i]; packet[20 + i] = packet[22 + i]; packet[22 + i] = tmp
        }
    }

    private fun recalculateChecksums(packet: ByteArray) {
        if (packet.size < 20) return
        // Zero out checksums — Android VPN stack accepts packets with zero checksum
        packet[10] = 0; packet[11] = 0  // IP checksum
        if (packet.size >= 26) { packet[26] = 0; packet[27] = 0 }  // UDP checksum
    }

    private fun buildIpUdpPacket(
        srcIp: ByteArray, dstIp: ByteArray,
        srcPort: Int, dstPort: Int,
        payload: ByteArray
    ): ByteArray {
        val udpLen = 8 + payload.size
        val ipLen = 20 + udpLen
        val buf = ByteBuffer.allocate(ipLen)
        // IP header
        buf.put(0x45.toByte())  // Version + IHL
        buf.put(0)              // DSCP + ECN
        buf.putShort(ipLen.toShort())
        buf.putShort(0)         // ID
        buf.putShort(0x4000)    // Flags + Fragment offset (Don't Fragment)
        buf.put(64)             // TTL
        buf.put(17)             // Protocol (UDP)
        buf.putShort(0)         // Checksum (0 = skip)
        buf.put(srcIp)
        buf.put(dstIp)
        // UDP header
        buf.putShort(srcPort.toShort())
        buf.putShort(dstPort.toShort())
        buf.putShort(udpLen.toShort())
        buf.putShort(0)         // Checksum (0 = skip)
        // Payload
        buf.put(payload)
        return buf.array()
    }

    private fun createNotifChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL_ID, "숏츠 차단 VPN", NotificationManager.IMPORTANCE_LOW).apply {
                description = "YouTube Shorts DNS 차단"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(ch)
        }
    }

    private fun buildNotification(): Notification {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("숏츠 디톡스")
                .setContentText("YouTube Shorts 차단 활성화")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setOngoing(true)
                .build()
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
                .setContentTitle("숏츠 디톡스")
                .setContentText("YouTube Shorts 차단 활성화")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setOngoing(true)
                .setPriority(Notification.PRIORITY_LOW)
                .build()
        }
    }

    override fun onDestroy() {
        stopVpn()
        super.onDestroy()
    }
}
