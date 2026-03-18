import type { Buggy } from "@/types/buggy";

export interface BuggyRepository {
  getLiveBuggies(): Promise<Buggy[]>;
}
