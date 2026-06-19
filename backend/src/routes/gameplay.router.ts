import { Router } from "express";
import * as gameplayController from "../controllers/gameplay.controller";
import { verifyInvite } from "../middlewares/invite-link.middleware";
import { asyncHandler } from "../middlewares/error-handlers";

const gameplayRouter = Router();

// Invite link creation endpoint
gameplayRouter.post("/invite/:rid/create", asyncHandler(gameplayController.createInvitationCode));

// Join game with invite link endpoint
// Need to apply the rate limiter middleware to prevent abuse of the invite code verification endpoint
gameplayRouter.post("/join/:rid", verifyInvite, asyncHandler(gameplayController.joinGameWithInvite));

export { gameplayRouter };