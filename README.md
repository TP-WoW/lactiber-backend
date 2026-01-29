# Lactiber Backend

1. Estructura de tablas recomendada (SQL Server)
2. Lógica de disparo (one-shot / interval / cron)
3. Flujo de trabajo completo (con locking seguro para concurrencia)
4. Procedimientos sugeridos (para “claim” y para registrar ejecuciones)
5. Buenas prácticas y puntos críticos

#1 Modelo de datos recomendado
##1.1. Tabla principal: EventTriggers (definición del evento)
Objetivo: contener qué ejecutar, cuándo ejecutar, cómo reintentar y estado.
Punto clave: usar NextRunAtUtc te simplifica muchísimo el worker: solo consulta “dame los triggers habilitados con NextRunAtUtc <= ahora y no bloqueados”.
##1.2. Tabla de historial: EventTriggerRuns (cada ejecución)
Objetivo: trazabilidad, auditoría, debug y métricas.
#2 ¿Cómo calcular “cuándo toca”? (Schedule semantics)
Te recomiendo un enfoque híbrido:

SQL Server guarda NextRunAtUtc (y lo actualiza tras cada ejecución).
Node.js se encarga de:
Reclamar (claim) un job vencido,
Ejecutar el SP,
Actualizar el NextRunAtUtc según reglas (Interval/Cron/Once),
Registrar el run en EventTriggerRuns.

Reglas típicas:
A) ScheduleType = 1 (Once)

RunAtUtc: fecha/hora única.
Tras ejecutar:

IsEnabled = 0 o NextRunAtUtc = NULL (o ambos), para que no vuelva a aparecer.

B) ScheduleType = 2 (Interval)

Ejecuta cada IntervalSeconds.
Tras ejecutar:

NextRunAtUtc = DATEADD(SECOND, IntervalSeconds, <base>)
<base> puede ser:
LastRunAtUtc (si quieres “intervalo desde última ejecución”)
o el NextRunAtUtc previo (si quieres evitar drift y mantener el ritmo)
Si AlignToClock=1: alineas a múltiplos de intervalo (p.ej. cada 5 min exactos).

C) ScheduleType = 3 (CronExpression)

Node calcula la siguiente ocurrencia “cron” (en UTC o en TimeZoneId).
Guardas el resultado en NextRunAtUtc.


#3 Flujo de trabajo (end-to-end)
##3.1. Worker Node.js (polling + locking)
Ciclo típico (cada X segundos):

GETDATE en UTC (Node usa new Date() pero conviertes a UTC).
Claim de 1..N triggers vencidos con un UPDATE...OUTPUT atómico:

Solo si:

IsEnabled=1
NextRunAtUtc <= now
No está bloqueado (LockedUntilUtc IS NULL OR LockedUntilUtc < now)
y opcional: no hay otro en ejecución con mismo ConcurrencyKey

Node recibe del OUTPUT:
TriggerId, ProcedureSchema, ProcedureName, ParamsJson, etc.
Node ejecuta el stored procedure indicado:
Importante: validar que el SP existe y pertenece a una whitelist (seguridad)

Si éxito:

Inserta run en EventTriggerRuns status Success
Actualiza LastRunAtUtc, LastStatus, limpia lock
Calcula y actualiza NextRunAtUtc según ScheduleType
Si Once: deshabilita

Si error:

Inserta run Failed
Incrementa CurrentRetryCount
NextRunAtUtc = now + backoff (o exponencial)
Si supera MaxRetries: deshabilita o marca como Failed permanente

##3.2. ¿Por qué el “lease” (LockedUntilUtc)?
Si el worker muere a mitad, el lock expira y otro worker puede reintentar.

#4 Procedimientos almacenados sugeridos (SQL)
##4.1. usp_ClaimDueTriggers (claim atómico)
Esto te evita carreras si tienes varios workers.

Notas:
READPAST evita que un worker se quede esperando filas bloqueadas por otro.
UPDLOCK garantiza que nadie más “clame” la misma fila.

##4.2. usp_ReportTriggerRunResult (actualizar estado + next run)
En lugar de hacer muchas queries desde Node, puedes encapsularlo.
Para CRON: lo habitual es que Node calcule la siguiente fecha y la pase a un SP tipo usp_SetNextRunAt(@TriggerId, @NextRunAtUtc) o ampliarlo con un parámetro @NextRunAtUtc en este SP.


#5 Seguridad (muy importante)
Como vas a ejecutar un SP cuyo nombre viene de tabla:

No construyas SQL dinámico libre tipo EXEC(@sql) en Node.
Haz una whitelist:

O en SQL: una tabla AllowedProcedures(SchemaName, ProcedureName)
O en el propio worker


Verifica que el SP existe y está permitido:

OBJECT_ID(QUOTENAME(schema)+'.'+QUOTENAME(name)) IS NOT NULL


Limita permisos:

El usuario SQL del worker solo puede ejecutar usp_ClaimDueTriggers, usp_ReportTriggerRunResult y los SP “permitidos”.
Ideal: firmar SP con certificado o usar roles.




#6 Resumen del flujo (diagrama mental)

Node Worker (cada 1–5s o 10s):

usp_ClaimDueTriggers(@NowUtc, @WorkerId, @MaxToClaim)


Para cada trigger “claimed”:

Ejecuta [schema].[procedure] con parámetros (JSON o parámetros tipados)
Si OK → usp_ReportTriggerRunResult(... success ...)
Si fail → usp_ReportTriggerRunResult(... fail ...)
Si es CRON → Node calcula NextRunAtUtc y lo actualiza

#7 Detalles prácticos (recomendaciones)

UTC siempre en DB (SYSUTCDATETIME()), y si necesitas “hora local”, guarda TimeZoneId y calcula en Node.
Decide si quieres que pueda solaparse una tarea:

Si NO: usa ConcurrencyKey + lógica para impedir claim si hay otro “Running” con misma clave.


Manejo de “tareas que tardan más que el lease”:

O renuevas LockedUntilUtc periódicamente (heartbeat)
O pones un lease amplio, pero cuidado con jobs colgados.


Si vas a tener muchos triggers: index por NextRunAtUtc es crítico.