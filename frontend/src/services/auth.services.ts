import { LoginRequestDTO, LoginRequestSchema, RegisterRequestDTO, RegisterRequestSchema } from "@zess-online-chess/shared";
import { HttpClient } from "./HttpClient"

export const userLogin = async (data: LoginRequestDTO) => {
    const { email, password, rememberMe } = LoginRequestSchema.parse(data);

    try {
        const result = await HttpClient.post("/auth/login", {
            email,
            password,
            rememberMe
        });

        return result.data;
    } catch (error) {
        throw error;
    }
}

export const userRegister = async (data: RegisterRequestDTO) => {
    const { name, email, username, password, confirmPassword } = RegisterRequestSchema.parse(data);

    try {
        const result = await HttpClient.post("/auth/register", {
            name,
            email,
            username,
            password,
            confirmPassword
        });

        return result.data;
    } catch (error) {
        throw error;
    }
}

export const refreshTokens = async (refreshToken: string) => {
    try {
        const result = await HttpClient.post("/auth/refresh", { refreshToken });

        return result.data;
    } catch (error) {
        throw error;
    }
}

export const userLogout = async () => {
    try {
        await HttpClient.post("/auth/logout");
    } catch (error) {
        throw error;
    }
}