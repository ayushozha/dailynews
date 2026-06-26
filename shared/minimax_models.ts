/** Latest MiniMax model IDs — override via .env when newer models ship. */
export const MINIMAX_IMAGE_MODEL = process.env.MINIMAX_IMAGE_MODEL ?? 'image-01';
export const MINIMAX_VIDEO_MODEL = process.env.MINIMAX_VIDEO_MODEL ?? 'MiniMax-Hailuo-2.3-Fast';
export const MINIMAX_TTS_MODEL = process.env.MINIMAX_TTS_MODEL ?? 'speech-2.8-turbo';