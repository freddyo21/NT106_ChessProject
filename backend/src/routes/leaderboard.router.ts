import { Router } from "express";
import { asyncHandler } from "../middlewares/error-handlers";
import * as leaderboardController from "../controllers/leaderboard.controller";

const leaderboardRouter = Router();

leaderboardRouter.get("/", asyncHandler(leaderboardController.getLeaderboard));

export { leaderboardRouter };
