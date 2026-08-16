import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

// No self sign-up: an admin creates every account (student/teacher/admin)
// with a username + initial password. Login uses those credentials; no OTP.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      id: "password",
      // Maps the login form's `username` param to the identifier the provider
      // uses to store/retrieve the account (the provider's `email` field).
      profile: (params) => {
        const username = String(params.username ?? "").trim().toLowerCase();
        return {
          email: username,
          username,
          name: String(params.name ?? username),
        };
      },
    }),
  ],
});
