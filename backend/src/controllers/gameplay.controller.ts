import { Request, Response } from "express"
import * as gameplayService from "../services/gameplay.service";
import { InvitationParametersSchema, SuccessResponseSchema } from "@zess-online-chess/shared";

export const createInvitationCode = async (req: Request, res: Response) => {
    try {
        const result = InvitationParametersSchema.safeParse(req.params);

        if (!result.success) {
            return res.status(400).json({
                error: "Invalid invitation parameters",
                details: result.error.issues
            });
        }

        const { rid: roomId } = result.data;

        // if (!roomId) {
        //     return res.status(400).json({ error: "Missing room id" });
        // }

        const { code, expiresAt } = gameplayService.createInvitationCode(roomId);

        const success = SuccessResponseSchema.parse({
            message: "Invitation code created successfully",
            data: {
                roomId,
                code,
                expiresAt
            }
        });

        return res.status(201).json(success);
    } catch (error) {
        return res.status(500).json({
            error: "Failed to create invitation code"
        });
    }
};

export const joinGameWithInvite = async (req: Request, res: Response) => {
    // This will be handled in the route after the verifyInvite middleware
    

    return res.status(200).json({
        message: "Successfully joined the game with invite code",
        data: {
            roomId: req.params.rid,
            socketEvent: "join_room",
            socketPayload: {
                roomId: req.params.rid,
            },
        },
    });
};
