"use server";

import argon2 from "argon2";
import crypto from "crypto";
import { createAdminClient, createSessionClient } from "@/lib/appwrite";
import { appwriteConfig } from "@/lib/appwrite/config";
import { Query, ID } from "node-appwrite";
import { parseStringify } from "@/lib/utils";
import { cookies } from "next/headers";
import { avatarPlaceholderUrl } from "@/constants";
import { redirect } from "next/navigation";

const handleError = (error: unknown, message: string) => {
  console.log(error, message);
  throw error;
};

const getUserByEmail = async (email: string) => {
  const { databases } = await createAdminClient();

  const result = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.usersCollectionId,
    [Query.equal("email", [email])],
  );

  return result.total > 0 ? result.documents[0] : null;
};

export const sendEmailOTP = async ({ email }: { email: string }) => {
  const { account } = await createAdminClient();

  try {
    const session = await account.createEmailToken(ID.unique(), email);

    return session.userId;
  } catch (error) {
    handleError(error, "Failed to send email OTP");
  }
};

export const checkEmailBreach = async (email: string) => {
  const API_KEY = process.env.LEAK_LOOKUP_API_KEY || "";

  const formData = new URLSearchParams();
  formData.append("key", API_KEY);
  formData.append("type", "email_address");
  formData.append("query", email);

  const response = await fetch("https://leak-lookup.com/api/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const data = await response.json();
  if(data.error == 'false') {
    const breaches = Object.keys(data.message);
    if (breaches.length > 0) {
      let breachList  = breaches.slice(0, 10).map((breach: string) => `- ${breach}`).join("\n");
      if (breaches.length > 10) {
        const remainingCount = breaches.length - 10;
        breachList += `\n- and ${remainingCount} more`;
      }
      return parseStringify({ error: false, safe: false, message: "Your email has been found in the following data breaches:\n"+breachList+"\n 🚨 We strongly recommend using a unique and strong password."});
      // return parseStringify({ safe: false, error: "⚠️ Security Alert: Your email has been found in the following data breaches:\n"+breachList+"\n 🚨 We strongly recommend using a unique and strong password."});
    }
    return parseStringify({ error:false, safe: true, message: "✅ No breaches found for this email."});
  }
  return data;
};

export const createAccount = async ({
  fullName,
  email,
  password,
}: {
  fullName: string;
  email: string;
  password: string;
}) => {
  const existingUser = await getUserByEmail(email);

  const hashedPassword = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16, // desired memory cost (16 MB)
    timeCost: 3, // number of iterations
    parallelism: 1, // parallelism factor
  });

  if (!existingUser) {
    const accountId = await sendEmailOTP({ email });
    if (!accountId) throw new Error("Failed to send an OTP");

    const { databases } = await createAdminClient();

    await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      ID.unique(),
      {
        fullName,
        email,
        avatar: avatarPlaceholderUrl,
        accountId,
        password: hashedPassword,
      },
    );
    return parseStringify({ accountId });
  }

  return parseStringify({ accountId: null, error: "User already exists" });
};

export const verifySecret = async ({
  accountId,
  password,
}: {
  accountId: string;
  password: string;
}) => {
  try {
    const { account } = await createAdminClient();

    const session = await account.createSession(accountId, password);
    
    (await cookies()).set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: true,
    });

    return parseStringify({ sessionId: session.$id });
  } catch (error) {
    return parseStringify({ sessionId: null, error: "Failed to verify OTP" });
    handleError(error, "Failed to verify OTP");
  }
};

export const getCurrentUser = async () => {
  try {
    const { databases, account } = await createSessionClient();

    const result = await account.get();

    const user = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.usersCollectionId,
      [Query.equal("accountId", result.$id)],
    );

    if (user.total <= 0) return null;

    return parseStringify(user.documents[0]);
  } catch (error) {
    console.log(error);
  }
};

export const signOutUser = async () => {
  const { account } = await createSessionClient();

  try {
    await account.deleteSession("current");
    (await cookies()).delete("appwrite-session");
  } catch (error) {
    handleError(error, "Failed to sign out user");
  } finally {
    redirect("/sign-in");
  }
};

export const signInUser = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  
  try {
    const existingUser = await getUserByEmail(email);
    
    if (existingUser && existingUser != null) {
      const isPasswordValid = await argon2.verify(existingUser.password, password);
      
      if(isPasswordValid) {
        await sendEmailOTP({ email });
        return parseStringify({ accountId: existingUser.accountId });
      }
      return parseStringify({ accountId: null, error: "Incorrect email or password" });
    }
    return parseStringify({ accountId: null, error: "User not found" });
  } catch (error) {
    handleError(error, "Failed to sign in user");
  }
};
