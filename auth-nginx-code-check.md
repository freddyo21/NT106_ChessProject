# Kiem tra code Auth Register/Login qua Nginx

Ngay kiem tra: 2026-05-20  
Pham vi: backend auth API, schema validate, repository PostgreSQL, Docker Compose va Nginx reverse proxy.

## Ket luan nhanh

Luong dang ky, xac thuc email va dang nhap da duoc noi tuyen dung:

- Client goi Nginx tai `http://localhost:8080`.
- Nginx proxy ve upstream `backend:3000`.
- Express mount API tai `/api/v1`.
- Auth router mount tai `/api/v1/auth`.
- Cac endpoint chinh:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/verify-email`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/logout`

Backend build TypeScript thanh cong bang:

```powershell
npm.cmd --workspace=backend run build
```

Luu y: chay `npm --workspace=backend run build` truc tiep tren PowerShell bi chan do execution policy cua `npm.ps1`, nen dung `npm.cmd`.

## Luong request qua Nginx

Nginx expose cong host:

```yaml
nginx:
  ports:
    - "8080:80"
```

Nginx cau hinh upstream:

```nginx
upstream nodes_be {
    ip_hash;
    server backend:3000;
}

location / {
    proxy_pass http://nodes_be;
}
```

Backend mount route:

```ts
app.use("/api/v1", globalLimiter, router);
router.use("/auth", authRouter);
```

Vay URL dung khi test qua Nginx la:

```text
http://localhost:8080/api/v1/auth/register
http://localhost:8080/api/v1/auth/verify-email
http://localhost:8080/api/v1/auth/login
```

## Dang ky

Endpoint:

```text
POST /api/v1/auth/register
```

Payload hop le:

```json
{
  "name": "Test User",
  "username": "testuser",
  "email": "test@example.com",
  "password": "Password@2026",
  "confirmPassword": "Password@2026"
}
```

Dieu kien validate:

- `name`: 2-50 ky tu.
- `username`: 2-50 ky tu.
- `email`: dung format email, toi da 75 ky tu trong schema register.
- `password`: toi thieu 8 ky tu, khong duoc chua chuoi `123456`.
- `confirmPassword`: phai trung `password`.
- Schema dang `.strict()`, nen payload thua field se bi reject.

Sau khi dang ky:

- Password duoc hash bang bcrypt voi `SALT_ROUNDS = 13`.
- User duoc insert vao bang `users`.
- `is_verified` mac dinh la `false`.
- Backend tao verify token va in ra log voi dong `VERIFY TOKEN: ...`.

## Xac thuc email

Endpoint:

```text
POST /api/v1/auth/verify-email
```

Payload:

```json
{
  "token": "TOKEN_LAY_TU_LOG_BACKEND"
}
```

Neu token hop le:

- Backend update `is_verified = true`.
- Sau do user moi dang nhap duoc.

Can chu y: token verify dang luu trong `Map` trong memory cua process backend. Neu container restart, token mat. Neu chay nhieu replica va request verify khong vao dung replica da tao token, API se tra loi token khong hop le.

## Dang nhap

Endpoint:

```text
POST /api/v1/auth/login
```

Payload:

```json
{
  "email": "test@example.com",
  "password": "Password@2026",
  "rememberMe": false
}
```

Luong xu ly:

1. Validate payload bang `LoginRequestSchema`.
2. Tim user theo email.
3. So sanh password bang bcrypt.
4. Tao access token JWT thoi han 15 phut.
5. Tao refresh token:
   - `7d` neu `rememberMe = false`.
   - `30d` neu `rememberMe = true`.
6. Neu `user.isVerified = false`, controller tra loi forbidden.

Response thanh cong co dang:

```json
{
  "message": "Logged in successfully.",
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 900,
  "user": {
    "isVerified": true
  }
}
```

## Lenh test qua Nginx

Khoi dong:

```powershell
cd D:\Auth-LTMCB\NT106_ChessProject
Copy-Item backend\.env.example backend\.env
docker compose up --build --scale backend=3 -d
docker compose ps
```

Kiem tra Nginx va backend:

```powershell
Invoke-RestMethod http://localhost:8080/
Invoke-RestMethod http://localhost:8080/api/v1/ping
docker compose exec nginx nginx -t
```

Dang ky:

```powershell
$registerBody = @{
  name = "Test User"
  username = "testuser"
  email = "test@example.com"
  password = "Password@2026"
  confirmPassword = "Password@2026"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://localhost:8080/api/v1/auth/register `
  -Method Post `
  -ContentType "application/json" `
  -Body $registerBody
```

Lay verify token:

```powershell
docker compose logs backend | Select-String "VERIFY TOKEN"
```

Verify email:

```powershell
$verifyBody = @{
  token = "DAN_TOKEN_VAO_DAY"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://localhost:8080/api/v1/auth/verify-email `
  -Method Post `
  -ContentType "application/json" `
  -Body $verifyBody
```

Login:

```powershell
$loginBody = @{
  email = "test@example.com"
  password = "Password@2026"
  rememberMe = $false
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://localhost:8080/api/v1/auth/login `
  -Method Post `
  -ContentType "application/json" `
  -Body $loginBody
```

Xem log neu loi:

```powershell
docker compose logs -f backend nginx
```

Dung moi truong:

```powershell
docker compose down
```

## Diem can sua hoac can luu y

### 1. Verify token va refresh token dang luu trong memory

File lien quan:

- `backend/src/services/auth.service.ts`
- `backend/src/utils/jwt-handler.ts`

Hien tai:

- `verifyTokenStore` la `Map` trong memory.
- `refreshTokenStore` la `Map` trong memory.
- Docker Compose dang cau hinh 3 replica backend.

Rui ro:

- Dang ky o replica A nhung verify vao replica B thi token khong ton tai.
- Login o replica A nhung refresh vao replica B thi refresh token khong ton tai.
- Restart container lam mat toan bo token dang song.

Huong xu ly nen lam:

- Dua verify token va refresh token sang Redis hoac database.
- Neu tam thoi demo local, co the chay 1 replica backend de test on dinh:

```powershell
docker compose up --build --scale backend=1 -d
```

### 2. Nginx co `ip_hash` nhung khong giai quyet het van de token memory

`ip_hash` giup cung mot client IP co xu huong vao cung backend. Tuy nhien:

- Neu backend restart, token memory mat.
- Neu Nginx restart hoac backend scale/recreate, upstream co the thay doi.
- Neu nhieu client qua cung NAT/proxy, phan bo co the khong nhu mong muon.

Voi production, khong nen dua tinh dung sai cua auth token vao sticky session.

### 3. Bien moi truong CORS bi lech ten

Trong `backend/.env.example`:

```env
FRONTEND_CORS_ALLOWED=http://localhost:1420
```

Nhung code doc:

```ts
process.env.FRONTEND_CORS_ALLOWED_ORIGINS
```

Tac dong:

- Curl/Postman van goi duoc vi request khong co `Origin`.
- Frontend browser tu `localhost:1420` co the bi CORS reject neu `.env` khong co dung bien `FRONTEND_CORS_ALLOWED_ORIGINS`.

Nen doi `.env.example` thanh:

```env
FRONTEND_CORS_ALLOWED_ORIGINS=http://localhost:1420
```

### 4. `depends_on` khong dam bao DB san sang

Compose co:

```yaml
depends_on:
  - db
```

`depends_on` chi dam bao thu tu start container, khong dam bao PostgreSQL da san sang nhan ket noi. Nen them healthcheck cho `db` va dieu kien health cho `backend`, hoac them retry khi backend query DB.

### 5. Race condition khi dang ky trung email/username

Service co check ton tai email/username truoc khi insert, DB cung co unique constraint. Neu 2 request cung luc, ca hai co the qua buoc check, mot request insert thanh cong, request con lai loi unique constraint tu PostgreSQL.

Nen catch loi unique constraint `23505` va tra ve response 409/400 ro rang thay vi de thanh loi he thong.

### 6. Nginx upstream resolve ten service tai thoi diem start

Cau hinh:

```nginx
server backend:3000;
```

Voi Docker Compose, neu backend container bi recreate sau khi Nginx da start, Nginx co the giu IP cu tuy vao cach resolve. Khi scale/recreate backend, nen restart Nginx hoac cau hinh resolver Docker DNS (`127.0.0.11`) neu can dynamic resolve.

## Danh gia cuoi

Trang thai hien tai phu hop de demo local:

- Register qua Nginx: co.
- Verify email qua token log: co, neu vao dung replica.
- Login qua Nginx: co, sau khi verify.
- TypeScript backend build: pass.

Can sua truoc khi dung nghiem tuc voi nhieu replica:

1. Chuyen verify/refresh token store tu memory sang Redis/database.
2. Sua ten bien CORS trong `.env.example`.
3. Them healthcheck/retry DB.
4. Xu ly duplicate email/username bang loi 409 ro rang.
