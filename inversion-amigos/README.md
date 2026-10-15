# Inversión Amigos — MVP

Aplicación web estática para gestionar un fondo de ahorro/inversión entre amigos.

## Incluye
- 9 participantes preconfigurados.
- Daniel Alzate y Camilo Sierra como administradores.
- Resto de participantes en modo solo lectura.
- Registro de aportes por fecha, persona y valor.
- Cálculo automático de ahorro colectivo, ahorro individual y porcentaje de participación.
- Registro de inversiones, entidad, capital y tasa E.A.
- Registro manual de intereses ganados.
- Dashboard responsive.

## Importante
Este MVP usa `localStorage`, por lo que los datos viven únicamente en el navegador y dispositivo donde se registran. No es suficiente para producción ni para acceso simultáneo de varias personas.

## Siguiente versión recomendada
Migrar a Supabase o Firebase para autenticación real por correo/contraseña, roles admin/read-only en servidor, base de datos compartida, trazabilidad de movimientos y backups.
