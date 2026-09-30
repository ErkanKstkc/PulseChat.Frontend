# PulseChat - AI Agent Governance & Architectural Guidelines (AGENTS.md)

Bu doküman, **PulseChat** ekosisteminde (Backend API, İstemciler ve Altyapı) kod üreten, refactor yapan veya mimari değişiklik gerçekleştiren tüm yapay zeka ajanları (AI Agents) ve geliştiriciler için bağlayıcı kılavuzdur. Projede **Spec-Driven Development (Spesifikasyon Odaklı Geliştirme)** ve **AI Governance** metodolojisi esastır.

---

## 1. Proje Kimliği ve Temel Amaç

- **Proje Adı:** PulseChat (Gerçek Zamanlı Yüksek Eşzamanlı Mesajlaşma Platformu)
- **Hedef Ölçek:** 1.000 – 2.000 Eşzamanlı Aktif Kullanıcı (Concurrent Users)
- **Ana Hedef:** Milisaniyeler düzeyinde düşük gecikmeli (low latency) anlık mesaj iletimi, oda/grup yönetimi, çevrimiçi durum takibi ve asenkron bildirim dağıtımı.
- **Tasarım Felsefesi:** Gereksiz karmaşıklıktan (over-engineering) arındırılmış, yalnızca açık kaynak ve ücretsiz teknolojiler üzerine kurulu, tip güvenli ve modüler bir yapı.

---

## 2. Kesin Mimari Kurallar (Non-Negotiable Invariants)

Her AI Ajanı aşağıdaki mimari kurallara **tavizsiz** uymak zorundadır:

### 2.1. Modular Monolith & Vertical Slice (CQRS)
1. **Tek Çalıştırılabilir Süreç:** Backend tek bir .NET 10 Web API uygulaması çatısı altında toplanacaktır (Mikroservis karmaşası ve ağ gecikmesi yasaktır).
2. **Dikey Dilimler (Vertical Slices):** Özellikler katmanlara göre değil, işlevsel dikey dilimlere (`Features/Auth/Register`, `Features/Chat/SendMessage`, `Features/Chat/GetHistory`) göre ayrılmalıdır.
3. **CQRS:** Komut (Command - durumu değiştiren) ve Sorgu (Query - salt veri okuyan) sorumlulukları kod düzeyinde ayrılacaktır.
4. **Separation of Concerns & Clean Architecture:** Çekirdek iş mantığı (`Domain` ve `Application`), dış kütüphaneleri (MongoDB Driver, RabbitMQ, Redis, SignalR) doğrudan bilmez; bağımlılıklar arayüzler (Interfaces) üzerinden tersine çevrilir.

### 2.2. Çift Veritabanı Ayrımı (Polyglot Persistence Boundary)
Veritabanı sorumlulukları kesin sınırlarla ayrılmıştır; birbirinin alanına müdahale edilemez:
- **PostgreSQL (EF Core):** Sadece ilişkisel ve ACID garantisi gerektiren veriler saklanır:
  - `POSTGRES_USER`: Kullanıcı kimlikleri, e-posta, parola hash'i, kullanıcı adı, profil linki.
  - `POSTGRES_REFRESH_TOKEN`: JWT oturum/yenileme token'ları.
  - `POSTGRES_FRIENDSHIP`: Arkadaşlık talepleri ve durumları (`PENDING`, `ACCEPTED`, `BLOCKED`).
- **MongoDB (Official C# Driver):** Yüksek yazma hacimli (heavy-write) sohbet verileri saklanır:
  - `MONGO_ROOM`: Sohbet odaları (DIRECT / GROUP), başlık, avatar, oda üyeleri (`MONGO_ROOM_MEMBER` array'i).
  - `MONGO_MESSAGE`: Mesajlar (`room_id`, `sender_id`, `client_message_id`, `type`, `content`, `media_url`, `created_at`).
  - **Kritik İndeks Kuralı:** MongoDB'de `room_id + created_at` bileşik (compound) indeksi ve `client_message_id` benzersiz (unique) indeksi mutlaka tanımlanmalıdır.

### 2.3. Olay Güdümlü Mesajlaşma (EDA - Event-Driven Architecture)
1. **HTTP/Socket Asla Kilitlenmez:** SignalR Hub üzerinden gelen mesaj gönderme çağrısı, veritabanına kayıt işlemi bitene kadar soketi bekletemez.
2. **Mesaj Akış Sıralaması (Sıralama Diyagramı Kuralı):**
   1. SignalR `ChatHub` mesajı alır (`roomId`, `clientMessageId`, `content`).
   2. Redis üzerinden `clientMessageId` kontrol edilir (**Idempotency**). Eğer anahtar varsa mükerrer kabul edilip işlem atlanır.
   3. Mesaj odadaki aktif çevrimiçi kullanıcılara SignalR üzerinden anında hafızadan iletilir (**Live In-Memory Delivery**).
   4. Aynı anda MassTransit ile RabbitMQ `chat.messages` exchange'ine `MessageCreatedEvent` fırlatılır.
   5. Göndericiye anlık teslimat onayı (`MessageDeliveredAck`) dönülür.
   6. Arka planda:
      - `MongoMessagePersistenceConsumer`: Olayı tüketir ve MongoDB'ye kaydeder.
      - `PushNotificationConsumer`: Alıcı Redis'te çevrimdışıysa Firebase (FCM) push bildirimi iletir.

### 2.4. Result Pattern (Hata Yönetim Standardı)
- API endpoint'leri ve SignalR metotlarında ham veri veya iş mantığı içinde doğrudan `throw new Exception` **fırlatılmayacaktır**.
- Tüm yanıtlar generic `Result<T>` veya `Result` tipi ile sarmalanır:
  ```csharp
  public class Result<T>
  {
      public bool IsSuccess { get; init; }
      public T? Data { get; init; }
      public string? ErrorCode { get; init; }
      public string? Message { get; init; }
  }
  ```
- Beklenmeyen sistem hataları ise küresel `ExceptionHandlingMiddleware` veya pipeline behavior ile yakalanarak RFC 7807 uyumlu ProblemDetails JSON formatına dönüştürülür.

### 2.5. Idempotency (Mükerrerlik Koruması)
- Mobil veya zayıf ağlarda kopup yeniden bağlanan istemcilerin ürettiği `clientMessageId` (GUID), Redis üzerinde TTL (ör. 10 dakika) ile saklanmalı ve kontrol edilmelidir. Aynı GUID ile gelen ikinci istek veritabanına mükerrer kayıt açamaz.

### 2.6. Contract-First & Frontend Codegen Uyumu
- Backend API'nin ürettiği OpenAPI (`swagger.json`) şeması, istemci kod üretiminde (`Orval`) kaynak kabul edilir.
- İstemci (Web/Mobil) tarafında **elle REST API fetch/axios fonksiyonu yazılamaz**. Tüm hook'lar ve DTO'lar Orval tarafından üretilir. Backend tarafındaki endpoint DTO'ları açık, tipli ve Swagger açıklamalarına sahip olmalıdır.

### 2.7. Redis Önbellek ve Durum Standartları
Redis anahtar hiyerarşisi aşağıdaki şablona uygun olmalıdır:
- Varlık (Presence): `presence:user:{userId}` -> `{ status: "online"|"offline", lastSeen: timestamp }`
- Bağlantı Haritası: `presence:conn:{connectionId}` -> `userId`
- Mesaj Idempotency: `idempotency:msg:{clientMessageId}` -> `1` (TTL: 10 dakika)
- Yazıyor Bildirimi (Typing): `typing:room:{roomId}:user:{userId}` -> `1` (TTL: 5 saniye)

### 2.8. Medya Depolama (MinIO)
- Görsel, ses kaydı ve dokümanlar veritabanında byte olarak saklanamaz.
- MinIO (S3-Uyumlu) depolama servisi kullanılır; veritabanında yalnızca dosyanın erişim URL'i (`media_url`) tutulur.

---

## 3. Teknoloji Yığını ve Versiyonlar

| Katman | Teknoloji | Versiyon / Standart |
| :--- | :--- | :--- |
| **Backend Çerçevesi** | .NET / ASP.NET Core | **.NET 10** |
| **Canlı İletişim** | ASP.NET Core SignalR | WebSocket tabanlı yerleşik hub |
| **İlişkisel Veritabanı** | PostgreSQL + EF Core | PostgreSQL 17 / Npgsql.EFCore |
| **Doküman Veritabanı** | MongoDB | MongoDB 7+ / Official C# Driver |
| **Mesaj Kuyruğu & Olay Yolu** | RabbitMQ + MassTransit | RabbitMQ 3.13+ / MassTransit |
| **Önbellek & Durum** | Redis | Redis 7+ / StackExchange.Redis |
| **Nesne Depolama** | MinIO (Self-Hosted) | MinIO S3 API |
| **Doğrulama (Validation)** | FluentValidation | MediatR Pipeline Behavior |
| **İstemci Kod Üretimi** | Orval | OpenAPI v3 -> React Query Hooks |
| **Konteynerleştirme** | Docker Compose | Çoklu servis geliştirme ortamı |

---

## 4. Backend Çözüm (Solution) Mimarisi ve Dizin Düzeni

`PulseChat.API` dizininde aşağıdaki modüler katman kurgusu takip edilecektir:

```
PulseChat.API/
├── docker-compose.yml                      # Postgres, Mongo, Redis, RabbitMQ, MinIO
├── PulseChat.sln
│
├── src/
│   ├── PulseChat.Domain/                   # Bağımsız çekirdek katman
│   │   ├── Common/                         # Result<T>, ErrorCodes, BaseEntity
│   │   ├── Entities/                       # Postgres EF Core modelleri (User, RefreshToken, Friendship)
│   │   └── Documents/                      # Mongo modelleri (RoomDocument, MessageDocument)
│   │
│   ├── PulseChat.Application/                # İş kuralları, CQRS dilimleri, Portlar/Arayüzler
│   │   ├── Behaviors/                      # ValidationBehavior, LoggingBehavior
│   │   ├── Common/Interfaces/              # IUserRepository, IMongoChatRepository, IRedisService, IStorageService
│   │   ├── Events/                         # MessageCreatedEvent
│   │   └── Features/                       # Vertical Slices
│   │       ├── Auth/                       # Register, Login, RefreshToken, Me
│   │       ├── Chat/                       # CreateRoom, SendMessage, GetRoomMessages, GetUserRooms
│   │       ├── Friendships/                # SendRequest, RespondRequest, GetFriends
│   │       └── Media/                      # UploadMedia
│   │
│   ├── PulseChat.Infrastructure/           # Dış araçların implementasyonları (Adaptörler)
│   │   ├── Persistence/Postgres/           # PulseChatDbContext, EntityConfigurations, Migrations
│   │   ├── Persistence/Mongo/              # MongoDbContext, Index Initializer
│   │   ├── Caching/Redis/                  # RedisPresenceService, RedisIdempotencyService
│   │   ├── Storage/Minio/                  # MinioStorageService
│   │   └── Messaging/MassTransit/          # RabbitMQ Bus Config, Event Publisher
│   │
│   ├── PulseChat.Workers/                  # Asenkron Tüketici Arka Plan Servisleri
│   │   └── Consumers/
│   │       ├── MongoMessagePersistenceConsumer.cs
│   │       └── PushNotificationConsumer.cs
│   │
│   └── PulseChat.API/                      # Web API Host, Controller'lar, SignalR Hub
│       ├── Controllers/                    # REST API Controllers (OpenAPI uyumlu)
│       ├── Hubs/                           # ChatHub (Real-time WebSocket Router)
│       ├── Middlewares/                    # ExceptionMiddleware, RequestLoggingMiddleware
│       └── Program.cs                      # IoC Container, Middleware Pipeline
│
└── tests/
    └── PulseChat.UnitTests/                # CQRS Handler, Domain ve Validation testleri
```

---

## 5. Kodlama Kuralları ve Standartlar

1. **C# Modern Dil Özellikleri:**
   - C# modern özellikleri (primary constructors, file-scoped namespaces, record tipleri, pattern matching) tercih edilmelidir.
   - `null` güvenliği (`<Nullable>enable</Nullable>`) açık tutulacak ve nullable uyarıları giderilecektir.
2. **DTO ve Request/Response İsimlendirmesi:**
   - Komutlar için: `{Feature}Command`, `{Feature}CommandHandler`, `{Feature}CommandValidator`, `{Feature}Response`.
   - Sorgular için: `{Feature}Query`, `{Feature}QueryHandler`, `{Feature}Response`.
3. **Endpoint Şeffaflığı (OpenAPI):**
   - Her controller metoduna `[ProducesResponseType(typeof(Result<T>), StatusCodes.Status200OK)]` gibi OpenAPI öznitelikleri eksiksiz yazılmalıdır.
4. **Güvenlik & Parola:**
   - Parolalar asla düz metin saklanamaz; `BCrypt.Net` veya ASP.NET `PasswordHasher` kullanılmalıdır.
   - JWT token süreleri kısa tutulmalı (ör. 15-60 dk), oturum devamlılığı `POSTGRES_REFRESH_TOKEN` üzerinden sağlanmalıdır.
5. **Kayıt (Logging):**
   - `ILogger<T>` yapısal loglama (structured logging) ile kullanılmalı, hassas veriler (parola, token vb.) loglara yazılmamalıdır.

---

## 6. Ajan İş Akışı ve Görev Denetim Listesi (Agent Workflow)

Bir AI Ajanı kod yazarken sırasıyla şu adımları izlemelidir:

1. **Gereksinimi Doğrula:** İlgili özelliğin dokümandaki hangi veri tabanına ve hangi dikey dilime ait olduğunu teyit et.
2. **Arayüz Odaklı Geliştir:** Domain veya Application katmanında kontratı/interface'i belirle, altyapı bağımlılığını enjekte et.
3. **Validasyon Ekle:** Her komut için FluentValidation kuralı tanımla.
4. **Result Sarmala:** Tüm dönüş tiplerini `Result<T>` standardına bağla.
5. **Build & Test:** Kod yazımı bitince projeyi derle (`dotnet build`) ve testleri koş (`dotnet test`).
6. **OpenAPI Şemasını Bozma:** İstemcilerin Orval ile kod üretebilmesi için swagger çıktı bütünlüğünü kontrol et.
