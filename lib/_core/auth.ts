import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";

export type User = {
  uid: string;
  name: string | null;
  email: string | null;
  photoUrl: string | null;
};

export function getCurrentUser(): User | null {
  const fbUser = auth().currentUser;
  if (!fbUser) return null;
  return mapFirebaseUser(fbUser);
}

export function onAuthStateChanged(callback: (user: User | null) => void) {
  return auth().onAuthStateChanged((fbUser) => {
    callback(fbUser ? mapFirebaseUser(fbUser) : null);
  });
}

export async function signOut(): Promise<void> {
  await auth().signOut();
}

function mapFirebaseUser(fbUser: FirebaseAuthTypes.User): User {
  return {
    uid: fbUser.uid,
    name: fbUser.displayName ?? null,
    email: fbUser.email ?? null,
    photoUrl: fbUser.photoURL ?? null,
  };
}
