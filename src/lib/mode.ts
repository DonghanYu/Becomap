/** GitHub Pages 읽기 전용 데모 빌드 여부(빌드 시점에 고정) */
export const IS_STATIC_DEMO = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
