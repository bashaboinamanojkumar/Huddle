import { cleanupFixtureSql } from "./fixture"

export default function globalTeardown(): void {
  cleanupFixtureSql()
}
