"use client";

import React from "react";
import Image from "next/image";
import { cn, getFileIcon } from "@/lib/utils";
import { useEffect, useState } from "react";
import { decryptFile } from "@/lib/actions/file.actions";

interface Props {
  type: string;
  extension: string;
  url?: string;
  imageClassName?: string;
  className?: string;
  fileId?: string;
  accountId?: string;
  mime?: string;
}

export const Thumbnail = ({
  type,
  extension,
  url = "",
  imageClassName,
  className,
  fileId,
  accountId,
  mime
}: Props) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = type === "image" && extension !== "svg";
  
  useEffect(() => {
    const generatePreview = async () => {
      if (isImage && fileId && accountId) {
        try {
          const decryptedFile = await decryptFile({ fileId: fileId, accountId: accountId });

          const blob = new Blob([decryptedFile], { type: mime });
          const objectURL = URL.createObjectURL(blob);
          setPreviewUrl(objectURL);
        } catch (error) {
          console.error("Error generating thumbnail:", error);
        }
      }
    };

    generatePreview();
  }, [fileId, accountId, type]);

  return (
    <div className="thumbnail">
      <figure className={cn("thumbnail", className)}>
        <Image
        src={(previewUrl && isImage) ? previewUrl : getFileIcon(extension, type)}
          alt="Decrypted preview"
          width={50}
          height={50} 
          className={cn(
            "size-8 object-contain",
            imageClassName,
            isImage && "thumbnail-image",
          )}
        />
      </figure>
    </div>
  );
};
export default Thumbnail;
