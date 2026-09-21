import type { GiteaUserDto } from "@/lib/gitea/types";
export function isAdminUser(user: GiteaUserDto | null): boolean { const allowed = (process.env.DAILYTRACK_ADMIN_LOGINS ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean); return Boolean(user?.login && allowed.includes(user.login.toLowerCase())); }

