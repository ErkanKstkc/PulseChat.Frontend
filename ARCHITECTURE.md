# PulseChat - Proje Teknik Dokümantasyonu ve Mimari Tasarım Raporu

**Proje Adı:** PulseChat (Gerçek Zamanlı Mesajlaşma Sistemi)  
**Hedef Ölçek:** 1.000 – 2.000 Eşzamanlı Aktif Kullanıcı (Concurrent Users)  
**Geliştirme Metodolojisi:** Spec-Driven Development (Spesifikasyon Odaklı Geliştirme) & AI Governance (Agent Denetimi)[cite: 16]

---

## 1. Yönetici Özeti ve Projenin Amacı
Bu proje; kurumsal standartlara tam uyumlu, modern, yüksek eşzamanlılık kapasitesine sahip ve ölçeklenebilir bir gerçek zamanlı mesajlaşma platformudur[cite: 1, 2]. Sistemin öncelikli odağı, 1.000 ila 2.000 aktif kullanıcı arasında milisaniyeler düzeyinde düşük gecikmeli (low latency) anlık mesajlaşma, oda/grup yönetimi, çevrimiçi durum takibi ve asenkron bildirim dağıtımı sağlamaktır[cite: 1, 2]. Sistem gereksiz karmaşıklıklardan (over-engineering) arındırılmış, yalnızca açık kaynaklı ve ücretsiz teknolojiler üzerine inşa edilmiştir[cite: 1].

---

## 2. Mimari Prensipler ve Tasarım Desenleri

### 2.1. Sistem Mimarileri
* **Modular Monolith:** Sistem tek bir çalıştırılabilir .NET Core Web API projesi çatısı altında, mantıksal ve fiziksel olarak birbirinden izole modüller (Auth, Chat, Notification, Media) şeklinde kurgulanmıştır[cite: 1, 4, 13]. Mikroservis operasyonel maliyetini ve ağ gecikmesini engeller[cite: 4, 11, 13].
* **Event-Driven Architecture (EDA):** Mesaj gönderme eylemi HTTP/Socket döngüsünü kilitlemez[cite: 1, 6]. Mesaj SignalR Hub'a ulaştığı anda doğrudan RabbitMQ olay kuyruğuna aktarılır; kalıcı veritabanı kaydı ve bildirim dağıtımı arka plan worker'ları tarafından asenkron olarak tüketilir[cite: 1, 2].
* **Vertical Slice & CQRS:** Modüller dikey dilimlere (Vertical Slices: `SendMessage`, `GetHistory`, `MarkAsRead`) ayrılmıştır[cite: 1, 11]. Komut (Command) ve Sorgu (Query) sorumlulukları kod seviyesinde izole edilmiştir[cite: 1, 19].
* **Separation of Concerns (SoC) & Clean Architecture:** Dış katmanlar iç katmanları bilir, ancak çekirdek iş mantığı hiçbir dış aracı (MongoDB, RabbitMQ, SignalR) doğrudan tanımaz; bağımlılıklar arayüzler (Interfaces) üzerinden tersine çevrilir[cite: 1, 11, 13].
* **Contract-First & Automated Code Generation (Orval):** Frontend tarafında manuel custom hook, fetch veya axios istekleri yazılmaz[cite: 2, 16]. .NET Web API tarafından dışa açılan OpenAPI (Swagger) şeması okunarak, tüm React Query hook'ları ve TypeScript tipleri `Orval` aracılığıyla otomatik üretilir[cite: 2].

### 2.2. Uygulanan Tasarım Desenleri (Design Patterns)
* **Publish-Subscribe (Pub/Sub) Deseni:** RabbitMQ üzerinde kurulan `Exchange` ve `Queue` yapısıyla mesajlar birden fazla tüketiciye (MongoDB Worker, FCM Push Worker) kayıpsız dağıtılır[cite: 1, 2, 11].
* **Cache-Aside Deseni:** Kullanıcıların online/offline durumu veya okunmamış mesaj sayaçları önce Redis üzerinde aranır (Cache Hit)[cite: 3, 4]. Veri yoksa veya ilk kez yükleniyorsa DB'den okunup Redis'e yazılır (Cache Miss)[cite: 3, 4].
* **Result Pattern:** API ve Hub yanıtlarında çıplak veri veya doğrudan `throw new Exception` fırlatmak yerine; `isSuccess`, `data`, `errorCode` ve `message` alanlarını taşıyan tip güvenli (type-safe) generic bir `Result<T>` sarmalayıcısı kullanılır[cite: 10, 15, 16].
* **Idempotency Deseni (Mükerrerlik Koruması):** Mobil ağlarda sinyal kopup tekrar bağlandığında istemci aynı mesajı iki kez atabilir[cite: 19]. İstemcinin ürettiği benzersiz `clientMessageId` (GUID), Redis üzerinde kontrol edilerek aynı mesajın mükerrer işlenmesi engellenir[cite: 19].
* **Centralized Exception Handling & Pipeline Behaviors:** Kodun içine `try-catch` blokları yığmak yerine, tüm hatalar küresel bir middleware veya pipeline behavior ile yakalanarak tek bir standart JSON formatına dönüştürülür ve merkezi loglama sistemine iletilir[cite: 10, 16].

---

## 3. Teknoloji Yığını ve Karar Matrisi

| Mimari Katman | Seçilen Teknoloji | Görev ve Sorumluluk | Seçilme Gerekçesi |
| :--- | :--- | :--- | :--- |
| **Backend API** | .NET 10 / ASP.NET Core | İş mantığı, WebSocket hub yönetimi, REST API servisleri ve OpenAPI üretimi[cite: 7, 14]. | Kurumsal şirket standardı, yüksek thread performansı ve kurumsal mimari desteği[cite: 1, 7, 14]. |
| **Canlı İletişim** | ASP.NET Core SignalR | WebSockets üzerinden çift yönlü gerçek zamanlı veri akışı[cite: 6]. | Ek sunucu maliyeti olmadan oda/grup ve bağlantı yönetimini yerleşik çözmesi[cite: 6]. |
| **Önyüz (Web)** | Next.js (React / TS) | Web sohbet arayüzü, oturum yönetimi[cite: 4, 7, 14]. | Bileşen modülerliği, hızlı render ve modern kullanıcı deneyimi[cite: 4, 7, 14]. |
| **Mobil İstemci** | React Native | iOS ve Android çapraz platform sohbet istemcisi[cite: 5]. | Ortak JS/TS ekosistemi ve yerel cihaz performansı[cite: 5]. |
| **API Client & Hooks** | Orval (Codegen) | OpenAPI şemasından otomatik React Query hook'ları ve DTO üretimi[cite: 2]. | Manuel fetch/hook yazımını bitirir, API değişikliklerinde compile-time tip güvenliği sağlar[cite: 2, 16]. |
| **Kod Kalitesi & Format** | ESLint & Prettier | Statik kod analizi, linting kuralları ve otomatik kod biçimlendirme[cite: 1, 6, 14]. | Ekip kodlama standardı, runtime hatalarını önleme ve homojen kod tabanı[cite: 1, 6, 14]. |
| **CI/CD & Otomasyon** | GitHub Actions | Lint, tip kontrolü, build, test koşumu ve sunucuya otomatik deployment[cite: 2, 3, 5]. | Hatasız entegrasyon, PR kontrolleri ve güvenli ortam değişkeni (Secrets) yönetimi[cite: 2, 3, 5]. |
| **Mesaj Veritabanı** | MongoDB | Mesaj geçmişi, sohbet odaları ve doküman kayıtları[cite: 1]. | Ağır yazma (heavy-write) dayanıklılığı, esnek şema ve bileşik indeksleme[cite: 14]. |
| **İlişkisel Veritabanı** | PostgreSQL | Kullanıcı kimlikleri, şifre hash'leri ve yetkiler[cite: 1, 4, 8]. | ACID garantisi, açık kaynak ve EF Core ile kusursuz uyum[cite: 1, 4, 8]. |
| **Mesaj Kuyruğu** | RabbitMQ | Asenkron olay dağıtımı (yazma ve bildirim worker'ları)[cite: 1, 2, 11]. | Gevşek bağlılık (loose coupling), güvenilir teslimat (ACK) ve sıfır kayıp garantisi[cite: 1, 2, 11]. |
| **Önbellek & Durum** | Redis (Docker) | Online/offline durumları, typing bildirimleri ve unread count[cite: 2, 3, 6]. | Milisaniyelik bellek içi hız ve veritabanı okuma yükünü sıfırlama[cite: 2, 3, 6]. |
| **Medya Depolama** | MinIO (Self-Hosted) | Görsel, ses kaydı ve dosya saklama (S3 Uyumlu)[cite: 1, 2, 10]. | Ücretsiz, açık kaynak nesne depolama, veritabanını şişirmeme[cite: 1, 2, 10]. |
| **Push Bildirim** | Firebase (FCM) | Mobil uygulama arka plandayken anlık bildirim iletme. | Tamamen ücretsiz, sektör standardı mobil bildirim altyapısı. |

---

## 4. Depo, CI/CD ve Kalite Güvence Stratejisi

### 4.1. Multi-repo Yapısı
* `pulsechat-backend`: .NET 10 API, MassTransit/RabbitMQ tüketicileri, EF Core ve MongoDB sürücüsü[cite: 1, 2, 7].
* `pulsechat-clients`: Monorepo (Turborepo) çatısı altında `apps/web` (Next.js), `apps/mobile` (React Native) ve OpenAPI çıktısını barındıran `packages/api-client`[cite: 2, 3, 10].

### 4.2. Statik Kod Kalite Hattı (ESLint & Prettier)
* Her iki istemcide ve backend'de kodlama kuralları kilitlenmiştir[cite: 1, 6, 14].
* **Temel Kural:** Elle tek bir REST API fetch/axios fonksiyonu yazılamaz; Orval tarafından üretilen modeller ve kancalar tüketilir[cite: 1, 2, 14].

### 4.3. GitHub Actions Pipeline
* **Pull Request Aşaması:** ESLint denetimi, Prettier format kontrolü, TypeScript tip doğrulaması (`tsc --noEmit`) ve Unit Test koşumu[cite: 1, 2, 5]. Hata varsa merge kilitlenir.
* **Deploy Aşaması:** Docker imajı inşası, GitHub Secrets enjeksiyonu ve prod sunucusuna otomatik servis yenileme[cite: 2, 3, 5].

---

## 5. Sistem ve Mimari Diyagramları

### 5.1. Sistem Mimarisi Diyagramı (System Architecture)
```mermaid
graph TB
    subgraph Clients ["İstemci Katmanı (Client Monorepo)"]
        Web["Next.js Web Client<br/>(Orval + React Query)"]
        Mobile["React Native Mobile App<br/>(Orval + FCM Client)"]
    end

    subgraph Gateway ["Ters Vekil / Giriş Kapısı"]
        Nginx["Nginx Reverse Proxy / SSL Termination"]
    end

    subgraph BackendApp [".NET 10 Modular Monolith (PulseChat.API)"]
        SignalR["SignalR Hub<br/>(Real-Time WebSocket Router)"]
        REST["REST API Controllers<br/>(OpenAPI / Swagger Generation)"]
        IdempotencyFilter["Idempotency & Auth Middleware<br/>(JWT + Redis Key Check)"]
        BusProducer["MassTransit / Event Bus Producer"]
    end

    subgraph Infrastructure ["Altyapı & Mesaj Kuyruğu"]
        RabbitMQ{{"RabbitMQ Broker<br/>('chat.messages' Exchange)"}}
        Redis[("Redis Cache<br/>(Online/Offline, Typing, TTL)")]
        MinIO[("MinIO Object Storage<br/>(S3-Compatible Media)")]
    end

    subgraph Workers ["Arka Plan Tüketicileri (Background Consumers)"]
        MongoWorker["MongoDB Persistence Consumer<br/>(Batch Insert / History)"]
        FCMWorker["Push Notification Consumer<br/>(Firebase Cloud Messaging)"]
    end

    subgraph Databases ["Kalıcı Veri Depoları"]
        Postgres[("PostgreSQL<br/>(Users, Auth, Friendships)")]
        Mongo[("MongoDB Cluster<br/>(Rooms, Messages, ReadReceipts)")]
    end

    Web -->|HTTP / HTTPS| Nginx
    Mobile -->|HTTP / HTTPS| Nginx
    Web -->|WSS / WebSocket| Nginx
    Mobile -->|WSS / WebSocket| Nginx

    Nginx -->|Proxy Pass| REST
    Nginx -->|WebSocket Upgrade| SignalR

    REST --> IdempotencyFilter
    IdempotencyFilter --> Redis
    IdempotencyFilter --> Postgres
    REST --> MinIO

    SignalR -->|Online/Presence/Typing| Redis
    SignalR -->|Message Envelope| BusProducer
    BusProducer -->|Publish 'MessageCreatedEvent'| RabbitMQ

    RabbitMQ -->|Consume| MongoWorker
    RabbitMQ -->|Consume| FCMWorker

    MongoWorker -->|Compound Indexed Insert| Mongo
    FCMWorker -->|Offline Push Delivery| Mobile
```

### 5.2. Mesaj Gönderim Sıralama Diyagramı (Sequence Diagram)
```mermaid
sequenceDiagram
    autonumber
    actor Alice as Alice (Gönderici)
    participant Hub as SignalR ChatHub (.NET)
    participant Redis as Redis (Presence & Idempotency)
    participant Rabbit as RabbitMQ (Exchange)
    actor BobOnline as Bob (Çevrimiçi Alıcı)
    participant Consumer as Mongo Persistence Worker
    participant Mongo as MongoDB (Messages DB)
    participant FCMWorker as FCM Push Consumer
    actor CharlieOffline as Charlie (Çevrimdışı Alıcı)

    Alice->>Hub: SendMessage(roomId, clientMessageId, content)
    activate Hub

    Hub->>Redis: Check & Set clientMessageId (Idempotency)
    alt Mesaj Zaten İşlendiyse (Mükerrer İstek)
        Hub-->>Alice: Result.Success (Ignoring duplicate)
    else Yeni Mesaj İse
        Hub->>Hub: Mesaj Paketi Oluştur (Server Timestamp)
        
        par Anlık Dağıtım (Live In-Memory Delivery)
            Hub->>BobOnline: ReceiveMessage(payload)
            Hub-->>Alice: MessageDeliveredAck(clientMessageId)
        and Asenkron Olay Kuyruğu (Event Publishing)
            Hub->>Rabbit: Publish MessageCreatedEvent
        end
    end
    deactivate Hub

    par MongoDB Kayıt Hattı
        Rabbit->>Consumer: Consume(MessageCreatedEvent)
        activate Consumer
        Consumer->>Mongo: InsertOne(MessageDocument)
        Consumer-->>Rabbit: BasicAck
        deactivate Consumer
    and Push Bildirim Hattı
        Rabbit->>FCMWorker: Consume(MessageCreatedEvent)
        activate FCMWorker
        FCMWorker->>Redis: Check Charlie Status
        Note over FCMWorker,Redis: Charlie = Offline / Background
        FCMWorker->>CharlieOffline: Send FCM Push Notification
        FCMWorker-->>Rabbit: BasicAck
        deactivate FCMWorker
    end
```

### 5.3. Veritabanı ve Doküman Şeması (ER & Document Diagram)
```mermaid
erDiagram
    %% PostgreSQL İlişkisel Tablolar
    POSTGRES_USER ||--o{ POSTGRES_REFRESH_TOKEN : has
    POSTGRES_USER ||--o{ POSTGRES_FRIENDSHIP : initiates

    POSTGRES_USER {
        uuid id PK
        string email UK
        string password_hash
        string username UK
        string avatar_url
        boolean is_active
        timestamp created_at
    }

    POSTGRES_REFRESH_TOKEN {
        uuid id PK
        uuid user_id FK
        string token UK
        timestamp expires_at
        boolean is_revoked
    }

    POSTGRES_FRIENDSHIP {
        uuid id PK
        uuid requester_id FK
        uuid addressee_id FK
        string status "PENDING | ACCEPTED | BLOCKED"
        timestamp created_at
    }

    %% MongoDB Doküman Koleksiyonları
    MONGO_ROOM ||--o{ MONGO_MESSAGE : contains
    MONGO_ROOM ||--o{ MONGO_ROOM_MEMBER : embeds

    MONGO_ROOM {
        ObjectId _id PK
        string type "DIRECT | GROUP"
        string title
        string avatar_url
        ObjectId created_by
        timestamp created_at
    }

    MONGO_ROOM_MEMBER {
        uuid user_id
        string role "ADMIN | MEMBER"
        timestamp joined_at
        timestamp last_read_at
    }

    MONGO_MESSAGE {
        ObjectId _id PK
        ObjectId room_id FK "Indexed"
        uuid sender_id "Indexed"
        string client_message_id UK "Idempotency Key"
        string type "TEXT | IMAGE | VOICE | FILE"
        string content
        string media_url
        timestamp created_at "Indexed (Compound with room_id)"
    }
```

### 5.4. İstemci Monorepo ve Kod Üretim Hattı (Client Architecture)
```mermaid
graph LR
    subgraph BackendAPI [".NET Web API"]
        Swagger["OpenAPI v3 Spec<br/>(swagger.json)"]
    end

    subgraph ClientMonorepo ["pulsechat-clients (Turborepo)"]
        subgraph PackageArea ["packages/api-client"]
            OrvalConfig["Orval Configuration<br/>(orval.config.ts)"]
            GenTypes["Generated DTOs & Types"]
            GenHooks["Generated React Query Hooks"]
        end

        subgraph SharedArea ["packages/shared-core"]
            SignalRHook["useSignalR Hub Hook"]
            Store["Zustand Auth/Chat Store"]
        end

        subgraph Apps ["Uygulama Katmanı"]
            WebNext["apps/web (Next.js 15)"]
            MobileRN["apps/mobile (React Native)"]
        end
    end

    Swagger -->|Read Schema| OrvalConfig
    OrvalConfig -->|Generate| GenTypes
    OrvalConfig -->|Generate| GenHooks

    GenTypes --> WebNext
    GenTypes --> MobileRN
    GenHooks --> WebNext
    GenHooks --> MobileRN

    SignalRHook --> WebNext
    SignalRHook --> MobileRN
    Store --> WebNext
    Store --> MobileRN
```