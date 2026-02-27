# 무한 루프 원인 분석

## 문제 흐름:
1. login.tsx에서 "테스트 모드로 시작" 클릭 → router.replace("/(tabs)")
2. (tabs)/index.tsx 로드됨
3. index.tsx의 useEffect에서 `!authLoading && !isAuthenticated` 체크
4. useAuth()는 실제 인증이 없으므로 isAuthenticated = false
5. router.replace("/login") 실행 → 다시 로그인 화면으로 돌아감
6. 무한 반복

## 해결 방법:
- 테스트 모드 상태를 전역으로 관리 (AppContext 또는 AsyncStorage)
- index.tsx에서 테스트 모드일 때 인증 리다이렉트 건너뛰기
- 다른 탭 화면에서도 동일하게 적용
