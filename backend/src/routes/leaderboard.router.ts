import { Router } from "express";
import { asyncHandler } from "../middlewares/error-handlers";
import * as leaderboardController from "../controllers/leaderboard.controller";

const leaderboardRouter = Router();

leaderboardRouter.get("/me", asyncHandler(leaderboardController.getMyProfileStats));
leaderboardRouter.get("/", asyncHandler(leaderboardController.getLeaderboard));

export { leaderboardRouter };
