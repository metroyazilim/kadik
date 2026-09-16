# Kaynak Haritası

| Sistem | Kaynak | Strateji | Kanıt | Durum |
|---|---|---|---|---|
| Admin/auth/Prisma | `78ee60e` starter | REUSE | Starter audit; mevcut `/manage` ve `prisma/schema.prisma` | reused |
| Public shell | Partiso referans URL'leri | ADAPT | `evidence/captures/reference/summary.json` | implemented |
| Public routes | `components/KadikSite.tsx` | EXTEND | Lokal route capture | implemented |
| API | Next route + Hono | EXTEND | `/api/kadik/contact`, `/api/kadik-api/health` 200 | implemented |
| Database | Starter PostgreSQL/Prisma | REUSE | Schema/migration mevcut; local Docker daemon unavailable | blocked-local |

Eski starter public sayfaları silinmedi; yeni Kadık rotaları kendi shell'ini kullanır. Gizli değerler repoya alınmaz.
