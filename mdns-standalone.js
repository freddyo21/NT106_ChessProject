import { Bonjour } from "bonjour-service";
import os from "os";

const PORT = 8080;

// Tìm đúng IP thật (Wi-Fi hoặc RadminVPN), tránh chọn nhầm VMware/WSL
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        if (/vmware|vethernet|wsl|virtualbox/i.test(name)) continue;
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                console.log(`Using interface: ${name} -> ${iface.address}`);
                return iface.address;
            }
        }
    }
    return null;
}

const localIp = getLocalIp();

const bonjour = new Bonjour();

const service = bonjour.publish({
    name: "ZessChessServer",
    type: "zesschess",
    port: PORT,
    host: localIp, // ép đúng IP thật
    txt: { version: "1.0" },
});

service.on("error", (err) => {
    console.error("[mDNS] Service error:", err);
});

console.log(`[mDNS] Published on ${localIp}:${PORT}`);
console.log("Press Ctrl+C to stop");

process.on("SIGINT", () => {
    bonjour.unpublishAll(() => {
        bonjour.destroy();
        process.exit(0);
    });
});