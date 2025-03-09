"use client";

import { Models } from "node-appwrite";
import Link from "next/link";
import Thumbnail from "@/components/Thumbnail";
import { convertFileSize } from "@/lib/utils";
import FormattedDateTime from "@/components/FormattedDateTime";
import ActionDropdown from "@/components/ActionDropdown";
import { decryptFile } from "@/lib/actions/file.actions";

const Card = ({ file }: { file: Models.Document }) => {

  const handleDecrypt = async (file: Models.Document) => {
    try {
        const decryptedFile = await decryptFile({ fileId: file.$id, accountId: file.accountId });

        const blob = new Blob([decryptedFile], { type: file.mime });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
    } catch (error) {
        console.error("Error decrypting file:", error);
    }
  };

  return (
    <Link href="#" className="file-card">
      <div className="flex justify-between">
        <Thumbnail
          type={file.type}
          extension={file.extension}
          url={file.url}
          fileId={file.$id}
          accountId={file.accountId}
          mime={file.mime}
          className="!size-20"
          imageClassName="!size-11"
        />

        <div className="flex flex-col items-end justify-between">
          <ActionDropdown file={file} />
          <p className="body-1">{convertFileSize(file.size)}</p>
        </div>
      </div>

      <div className="file-card-details" onClick={() => handleDecrypt(file)}>
        <p className="subtitle-2 line-clamp-1">{file.name}</p>
        <FormattedDateTime
          date={file.$createdAt}
          className="body-2 text-light-100"
        />
        <p className="caption line-clamp-1 text-light-200">
          By: {file.owner.fullName}
        </p>
      </div>
    </Link>
  );
};
export default Card;
