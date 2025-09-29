export const getIsAsset = (ext: string) => {
  const isAsset = [
    "jpg",
    "jpeg",
    "webp",
    "gif",
    "png",
    "mp3",
    "mp4",
    "wav",
    "mov",
    "png",
    "jpx",
  ].includes(ext);

  return isAsset;
};
