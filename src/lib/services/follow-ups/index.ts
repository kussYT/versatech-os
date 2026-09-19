import "server-only";

export { FollowUpService, listFollowUps, createFollowUp, completeFollowUp } from "./service";
export type {
  ListFollowUpsInput,
  CreateFollowUpInput,
  CompleteFollowUpInput,
  FollowUpWriteResult,
} from "./service";
export { mapFollowUpAgent, mapFollowUpList } from "./map";
export * from "./schema";
