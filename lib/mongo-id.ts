const MONGO_OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i

export function isMongoObjectId(value: unknown): value is string {
  return typeof value === "string" && MONGO_OBJECT_ID_PATTERN.test(value)
}
