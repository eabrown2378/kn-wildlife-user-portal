import { createContext } from "react";

/**
 * The signed-in account, and the actions that change it.
 *
 * `user` is null when nobody is signed in and while the session is still being checked on
 * load; `loading` distinguishes the two.
 *
 * `promptSignIn` opens the sign-in panel over the portal. It is called at the point data is
 * requested, since browsing what the portal holds needs no account.
 */
export const AuthContext = createContext({
    user: null,
    loading: true,
    promptSignIn: () => {},
    signIn: async () => {},
    register: async () => {},
    verify: async () => {},
    signOut: async () => {},
});
