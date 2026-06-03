import { Router } from "express";
import { verifyInvite } from "../middlewares/invite-link.middleware";
import * as gameplayController from "../controllers/gameplay.controller";

const gameplayRouter = Router();

// Invite link creation endpoint
gameplayRouter.post("/invite/:rid/create", gameplayController.createInvitationCode);

// Join game with invite link endpoint
// Need to apply the rate limiter middleware to prevent abuse of the invite code verification endpoint
gameplayRouter.post("/join/:rid", verifyInvite, gameplayController.joinGameWithInvite);

export { gameplayRouter };