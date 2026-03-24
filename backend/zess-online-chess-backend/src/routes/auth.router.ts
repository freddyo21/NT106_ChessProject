import { Router } from "express";
import * as authController from "../controllers/auth.controller";

const authRouter = Router();

authRouter.post("/login", authController.login);
authRouter.post("/register", authController.register);
authRouter.post("/logout", authController.logout);

export { authRouter };