import type { Buggy } from "@/types/public-monitoring";

export interface BuggyRepository {
  getLiveBuggies(): Promise<Buggy[]>;
}
