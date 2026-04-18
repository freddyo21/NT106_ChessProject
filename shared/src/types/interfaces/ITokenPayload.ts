import { JwtPayload } from "jsonwebtoken";

export interface ITokenPayload extends JwtPayload {
    id: string;
    email: string;
    username: string;
    role: string;
    status: string;
}