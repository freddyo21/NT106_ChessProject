import { NextFunction, Request, Response } from "express";
import { verifyInvitationCode } from "../services/gameplay.service";
import { invitationParametersSchema } from "@zess-online-chess/shared";

export const verifyInvite = async (req: Request, res: Response, next: NextFunction) => {
    const result = invitationParametersSchema.safeParse(req.params);

    if (!result.success) {
        return res.status(400).json({
            error: "Invalid invitation parameters",
            details: result.error.issues
        });
    }

    const { rid: roomId } = result.data;

    const { code } = req.query;

    if (!code || !roomId) {
        return res.status(400).json({ error: "Missing invitation code or room id" });
    }

    const codeValue = Array.isArray(code) ? code[0] : code;
    const codeString = typeof codeValue === "string" ? codeValue : null;

    if (!codeString) {
        return res.status(400).json({ error: "Missing invitation code" });
    }

    const validationResult = verifyInvitationCode(
        roomId,
        codeString
    );

    if (!validationResult.isValid) {
        return res.status(403).json({ error: validationResult.error ?? "Invalid invitation code" });
    }

    next();
};