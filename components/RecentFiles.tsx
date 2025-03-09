"use client";

import { Models } from "node-appwrite";
import { FormattedDateTime } from "@/components/FormattedDateTime";
import { Thumbnail } from "@/components/Thumbnail";
import ActionDropdown from "@/components/ActionDropdown";
import { decryptFile } from "@/lib/actions/file.actions";

interface RecentFilesProps {
  files: Models.Document[];
}

const RecentFiles = ({ files }: RecentFilesProps) => {

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
    <section className="dashboard-recent-files">
      <h2 className="h3 xl:h2 text-light-100">Recent files uploaded</h2>
      {files.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-5">
          {files.map((file) => (
            <div
              className="flex items-center gap-3 text-left cursor-pointer"
              key={file.$id}
            >
              <Thumbnail
                type={file.type}
                extension={file.extension}
                url={file.url}
                fileId={file.$id}
                accountId={file.accountId}
                mime={file.mime}
              />
              <div className="recent-file-details">
                <div className="flex flex-col gap-1" onClick={() => handleDecrypt(file)}>
                  <p className="recent-file-name">{file.name}</p>
                  <FormattedDateTime
                    date={file.$createdAt}
                    className="caption"
                  />
                </div>
                <ActionDropdown file={file} />
              </div>
            </div>
          ))}
        </ul>
      ) : (
        <p className="empty-list">No files uploaded</p>
      )}
    </section>
  );
};

export default RecentFiles;