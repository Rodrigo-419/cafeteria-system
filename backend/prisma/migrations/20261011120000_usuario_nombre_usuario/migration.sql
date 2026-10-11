-- Reemplaza el identificador de acceso: de `email` a `nombre_usuario`.
--
-- El nombre de usuario sustituye por completo al correo electronico. Para no
-- perder a los usuarios que ya existen, el valor de cada fila se deriva de la
-- parte local del correo (lo anterior a la "@"), normalizada a minusculas y
-- saneada a los caracteres permitidos (a-z, 0-9, punto, guion y guion bajo).
-- Si el resultado no alcanza la longitud minima (3) se completa con ceros; si
-- excede la maxima (30) se recorta. Las colisiones se resuelven con un sufijo
-- numerico incremental (nombre, nombre2, nombre3, ...).

-- 1. Renombra la columna conservando los datos existentes.
ALTER TABLE "usuario" RENAME COLUMN "email" TO "nombre_usuario";

-- 2. Renombra el indice unico para que siga el nombre que genera Prisma.
ALTER INDEX "usuario_email_key" RENAME TO "usuario_nombre_usuario_key";

-- 3. Sanea y desambigua los valores existentes.
DO $$
DECLARE
  fila RECORD;
  base TEXT;
  candidato TEXT;
  sufijo INTEGER;
BEGIN
  FOR fila IN SELECT id, "nombre_usuario" AS correo FROM "usuario" LOOP
    base := lower(split_part(fila.correo, '@', 1));
    base := regexp_replace(base, '[^a-z0-9._-]', '', 'g');

    -- El nombre de usuario debe empezar por letra o digito.
    IF base !~ '^[a-z0-9]' THEN
      base := 'u' || base;
    END IF;

    base := left(base, 30);
    IF length(base) < 3 THEN
      base := rpad(base, 3, '0');
    END IF;

    candidato := base;
    sufijo := 1;
    WHILE EXISTS (
      SELECT 1 FROM "usuario"
      WHERE "nombre_usuario" = candidato AND id <> fila.id
    ) LOOP
      sufijo := sufijo + 1;
      candidato := left(base, 30 - length(sufijo::text)) || sufijo::text;
    END LOOP;

    UPDATE "usuario" SET "nombre_usuario" = candidato WHERE id = fila.id;
  END LOOP;
END $$;
