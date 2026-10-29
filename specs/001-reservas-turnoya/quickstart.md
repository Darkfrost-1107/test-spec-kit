# Quickstart: TurnoYa v1

Requisitos: Node.js ≥ 24. Sin `npm install` (no hay dependencias).

```bash
npm run seed     # crea data/turnoya.db con datos de demostración
npm start        # http://localhost:3000
npm test         # suite completa (unitarias + integración)
```

Cuentas de demostración (solo desarrollo; se crean con `npm run seed`):

| Rol | Correo | Contraseña |
|-----|--------|------------|
| Administrador | admin@turnoya.test | Admin1234 |
| Recepción | recepcion@turnoya.test | Recep1234 |
| Médico | medico@turnoya.test | Medico1234 |
| Paciente | paciente@turnoya.test | Paciente1234 |

Variables: `PORT` (3000), `CLINIC_TZ` (America/Lima), `DB_PATH` (data/turnoya.db).

## Escenarios de verificación manual (uno por historia)

1. **US1** — Registrarse en `/registro`, buscar en `/disponibilidad`, reservar, ver la cita en
   `/mis-citas` y el correo en `/admin/correos` o `data/mails/`.
2. **US2** — En `/mis-citas`, reprogramar y cancelar; comprobar que una cita a menos de 24 h no
   muestra esas acciones. El recordatorio se comprueba en pruebas con reloj falso.
3. **US3** — Como recepción, abrir `/recepcion/agenda`, crear una cita, marcar “no asistió” tres
   veces a un paciente y comprobar que no puede reservar en línea.
4. **US4** — Como médico, crear un bloqueo en `/medico/bloqueos` y verificar que desaparece de la
   disponibilidad.
5. **US5** — Como administrador, crear una especialidad, un médico, su horario y un feriado.
