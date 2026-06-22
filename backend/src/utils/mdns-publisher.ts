import { Bonjour } from "bonjour-service";

let bonjourInstance: Bonjour | null = null;

export const publishMdnsService = (port: number) => {
    bonjourInstance = new Bonjour();
    bonjourInstance.publish({
        name: "ZessChessServer",
        type: "zesschess",
        port,
        txt: { version: "1.0" },
    });
    console.log(`[mDNS] Published service on port ${port}`);
};

export const stopMdnsService = () => {
    bonjourInstance?.unpublishAll(() => {
        bonjourInstance?.destroy();
    });
};