"use server";

import { createAdminClient, createSessionClient } from "@/lib/appwrite";
import { InputFile } from "node-appwrite/file";
import { appwriteConfig } from "@/lib/appwrite/config";
import { ID, Models, Query } from "node-appwrite";
import { constructFileUrl, getFileType, parseStringify } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/actions/user.actions";
import { Buffer } from "buffer";
import argon2 from "argon2";
import * as crypto from 'crypto';

const handleError = (error: unknown, message: string) => {
  console.log(error, message);
  throw error;
};

const generateKey = async (password: string, salt: string) => {
  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
    salt: Buffer.from(salt, 'hex'),
    hashLength: 32
  });
  
  return Buffer.from(hash).subarray(0, 32);
};

export const uploadFile = async ({
  file,
  ownerId,
  accountId,
  path,
}: {
  file: File;
  ownerId: string;
  accountId: string;
  path: string;
}) => {
  const { storage, databases } = await createAdminClient();

  try {
    const password = process.env.ENCRYPTION_PASSWORD; // Encryption password from env
    if (!password) {
      throw new Error("Encryption password is missing from environment variables.");
    }

    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(16);
    const key = await generateKey(password, salt.toString('hex'));
    const fileType = file.type;
    
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encryptedData = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
    
    const inputFile = InputFile.fromBuffer(encryptedData, file.name);

    // Upload the encrypted file to Appwrite
    const bucketFile = await storage.createFile(
      appwriteConfig.bucketId,
      ID.unique(),
      inputFile
    );

    const fileDocument = {
      type: getFileType(bucketFile.name).type,
      name: bucketFile.name,
      url: constructFileUrl(bucketFile.$id),
      extension: getFileType(bucketFile.name).extension,
      size: bucketFile.sizeOriginal,
      owner: ownerId,
      accountId,
      users: [],
      bucketFileId: bucketFile.$id,
      salt: Buffer.concat([salt, iv]).toString('base64'),
      mime: fileType
    };

    const newFile = await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      ID.unique(),
      fileDocument
    );

    revalidatePath(path);
    return parseStringify(newFile);
  } catch (error) {
    handleError(error, "Failed to upload file");
  }
};

export const decryptFile = async ({ fileId, accountId }: { fileId: string; accountId: string }) => {
  const { storage, databases } = await createAdminClient();

  try {
    const password = process.env.ENCRYPTION_PASSWORD;
    if (!password) {
      throw new Error("Encryption password is missing from environment variables.");
    }

    const fileDoc = await databases.getDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      fileId
    );
   
    if (!fileDoc?.salt) throw new Error("Salt not found for file.");

    const saltIvBuffer = Buffer.from(fileDoc.salt, 'base64');
    const salt = saltIvBuffer.subarray(0, 16);
    const iv = saltIvBuffer.subarray(16, 32);
    
    const key = await generateKey(password, salt.toString('hex'));
    
    const encryptedData = await fetch(fileDoc.url);

    const encryptedBuffer = Buffer.from(await encryptedData.arrayBuffer());

    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decryptedData = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);

    if (!decryptedData) throw new Error("Decryption failed: Invalid key or data.");
    return decryptedData;
    return parseStringify({ success: true, data: decryptedData });
  } catch (error) {
    handleError(error, "Failed to decrypt file");
  }
};

// Upload function without encryption
// export const uploadFile = async ({
//   file,
//   ownerId,
//   accountId,
//   path,
// }: UploadFileProps) => {
//   const { storage, databases } = await createAdminClient();

//   try {
//     const inputFile = InputFile.fromBuffer(file, file.name);

//     const bucketFile = await storage.createFile(
//       appwriteConfig.bucketId,
//       ID.unique(),
//       inputFile,
//     );

//     const fileDocument = {
//       type: getFileType(bucketFile.name).type,
//       name: bucketFile.name,
//       url: constructFileUrl(bucketFile.$id),
//       extension: getFileType(bucketFile.name).extension,
//       size: bucketFile.sizeOriginal,
//       owner: ownerId,
//       accountId,
//       users: [],
//       bucketFileId: bucketFile.$id,
//     };

//     const newFile = await databases
//       .createDocument(
//         appwriteConfig.databaseId,
//         appwriteConfig.filesCollectionId,
//         ID.unique(),
//         fileDocument,
//       )
//       .catch(async (error: unknown) => {
//         await storage.deleteFile(appwriteConfig.bucketId, bucketFile.$id);
//         handleError(error, "Failed to create file document");
//       });

//     revalidatePath(path);
//     return parseStringify(newFile);
//   } catch (error) {
//     handleError(error, "Failed to upload file");
//   }
// };

const createQueries = (
  currentUser: Models.Document,
  types: string[],
  searchText: string,
  sort: string,
  limit?: number,
) => {
  const queries = [
    Query.or([
      Query.equal("owner", [currentUser.$id]),
      Query.contains("users", [currentUser.email]),
    ]),
  ];

  if (types.length > 0) queries.push(Query.equal("type", types));
  if (searchText) queries.push(Query.contains("name", searchText));
  if (limit) queries.push(Query.limit(limit));

  if (sort) {
    const [sortBy, orderBy] = sort.split("-");

    queries.push(
      orderBy === "asc" ? Query.orderAsc(sortBy) : Query.orderDesc(sortBy),
    );
  }

  return queries;
};

export const getFiles = async ({
  types = [],
  searchText = "",
  sort = "$createdAt-desc",
  limit,
}: GetFilesProps) => {
  const { databases } = await createAdminClient();

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) throw new Error("User not found");

    const queries = createQueries(currentUser, types, searchText, sort, limit);

    const files = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      queries,
    );

    // console.log({ files });
    return parseStringify(files);
  } catch (error) {
    handleError(error, "Failed to get files");
  }
};

export const renameFile = async ({
  fileId,
  name,
  extension,
  path,
}: RenameFileProps) => {
  const { databases } = await createAdminClient();

  try {
    const newName = `${name}.${extension}`;
    const updatedFile = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      fileId,
      {
        name: newName,
      },
    );

    revalidatePath(path);
    return parseStringify(updatedFile);
  } catch (error) {
    handleError(error, "Failed to rename file");
  }
};

export const updateFileUsers = async ({
  fileId,
  emails,
  path,
}: UpdateFileUsersProps) => {
  const { databases } = await createAdminClient();

  try {
    const updatedFile = await databases.updateDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      fileId,
      {
        users: emails,
      },
    );

    revalidatePath(path);
    return parseStringify(updatedFile);
  } catch (error) {
    handleError(error, "Failed to rename file");
  }
};

export const deleteFile = async ({
  fileId,
  bucketFileId,
  path,
}: DeleteFileProps) => {
  const { databases, storage } = await createAdminClient();

  try {
    const deletedFile = await databases.deleteDocument(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      fileId,
    );

    if (deletedFile) {
      await storage.deleteFile(appwriteConfig.bucketId, bucketFileId);
    }

    revalidatePath(path);
    return parseStringify({ status: "success" });
  } catch (error) {
    handleError(error, "Failed to rename file");
  }
};

// ============================== TOTAL FILE SPACE USED
export async function getTotalSpaceUsed() {
  try {
    const { databases } = await createSessionClient();
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error("User is not authenticated.");

    const files = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.filesCollectionId,
      [Query.equal("owner", [currentUser.$id])],
    );

    const totalSpace = {
      image: { size: 0, latestDate: "" },
      document: { size: 0, latestDate: "" },
      video: { size: 0, latestDate: "" },
      audio: { size: 0, latestDate: "" },
      other: { size: 0, latestDate: "" },
      used: 0,
      all: 2 * 1024 * 1024 * 1024 /* 2GB available bucket storage */,
    };

    files.documents.forEach((file) => {
      const fileType = file.type as FileType;
      totalSpace[fileType].size += file.size;
      totalSpace.used += file.size;

      if (
        !totalSpace[fileType].latestDate ||
        new Date(file.$updatedAt) > new Date(totalSpace[fileType].latestDate)
      ) {
        totalSpace[fileType].latestDate = file.$updatedAt;
      }
    });

    return parseStringify(totalSpace);
  } catch (error) {
    handleError(error, "Error calculating total space used:, ");
  }
}
