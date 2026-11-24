DASTURLASH KURSI — YANGILANGAN FAYLLAR

Fayllar:
- server.js
- app.js
- index.html
- styles.css
- package.json

Asosiy tuzatishlar:
1. AI Studio dizayni yangilandi.
2. Gemini xatolari foydalanuvchiga aniqroq ko‘rsatiladi (API kaliti/quota/model/ulanish xatolari).
3. 2- va keyingi dars qismlari oldingi qism testiga bog‘liq emas. Har bir darsning o‘z testi uchun video 90% ko‘rilishi talabi saqlanadi.
4. Har bir mavzu uchun AI testi 80% natija bilan yakunlanadi va birinchi muvaffaqiyatda 30 XP beradi.
5. Barcha mavzu testlari tugagach, AI 15 savolli yakuniy imtihon yaratadi. Undan 80% yoki yuqori natija bilan o‘tilgandan keyingina kurs sertifikati beriladi.
6. Admin AI testlarini ko‘rishi/tahrirlashi/o‘chirishi mumkin. O‘chirilgan AI testi keyingi so‘rovda eski savollarni takrorlamasdan yangi test bilan almashtiriladi.
7. Sertifikat raqami yangi sertifikatlarda SM + 12 ta tasodifiy HEX belgi ko‘rinishida, chiziqchasiz bo‘ladi. Eski DK-/SM- raqamli sertifikatlarni tekshirish ham saqlanadi.
8. QR kod sertifikat sanasidan yuqori o‘ng tomonga ko‘chirildi; skaner /verify/<raqam> sahifasida sertifikat haqiqiyligini va ma’lumotlarini ko‘rsatadi.
9. Logo yo‘li logo-mark.png ga o‘zgartirildi. certificate-signature.png ga tegilmadi.

MUHIM:
- Render → Environment ichida mavjud GEMINI_API_KEY qiymati bo‘lishi shart. Agar hali kiritilmagan bo‘lsa, Gemini AI ishlamaydi. GEMINI_MODEL ixtiyoriy; bo‘sh bo‘lsa gemini-2.5-flash ishlatiladi.
- Mavjud MONGODB_URI, ADMIN_USER, ADMIN_PASS, JWT_SECRET, Telegram va boshqa environment qiymatlarini o‘chirmang yoki almashtirmang.
- `logo-mark.png` va `certificate-signature.png` fayllari GitHub repozitoriyda avvalgidek saqlansin.
- Bu fayllar statik tekshiruvdan o‘tkazildi (Node.js sintaksisi va package.json). Render/MongoDB/Gemini bilan jonli deploy testi bajarilmadi.

Joylash:
GitHub repozitoriydagi shu nomli 5 ta faylni yangilanganlari bilan almashtiring. Render odatda yangi commitdan keyin avtomatik deploy qiladi.
