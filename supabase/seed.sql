-- Catálogo inicial de Polyamsa. Ejecutar después de la migración.
insert into public.config (id, data) values (1, '{"horasProd":10,"turno1Inicio":7,"umbralBajo":85,"umbralRec":105,"ventanaDias":30,"nEscrita":2,"nActa":3,"nReconoc":5,"margenKg":null,"excusadas":["Mecánico","Eléctrico","Falta de material"]}')
on conflict (id) do nothing;

-- Extrusión
insert into public.maquinas (id,tipo,nombre,marca,estado,orden,densidades,ancho_max,notas) values
('ext1','extrusion','Extrusora 1','Carnevali','Activa',10,'{baja}',null,null),
('ext2','extrusion','Extrusora 2','Carnevali','Activa',20,'{baja}',null,null),
('ext3','extrusion','Extrusora 3','Carnevali','Activa',30,'{baja,alta}',null,null),
('ext4','extrusion','Extrusora 4','China chica','Activa',40,'{baja}',50,'Medidas de 50 cm para abajo'),
('ext5','extrusion','Extrusora 5','China chica','Activa',50,'{baja}',50,'Medidas de 50 cm para abajo'),
('ext6','extrusion','Extrusora 6','Por confirmar','En camino',60,'{baja,alta}',null,'Viene con dado de alta para bolsa en rollo')
on conflict (id) do nothing;

-- Impresión (rodillos = repetición en cm × cantidad)
insert into public.maquinas (id,tipo,nombre,marca,estado,orden,tintas,imp_max,mat_max,caras,rodillos,notas) values
('imp1','impresion','Impresora 1','Sicosa','Activa',110,6,117,120,1,'[{"rep":30,"cant":6},{"rep":35,"cant":6},{"rep":40,"cant":6},{"rep":45,"cant":6},{"rep":50,"cant":6},{"rep":56,"cant":6},{"rep":60,"cant":6},{"rep":65,"cant":6},{"rep":70,"cant":6},{"rep":80,"cant":6}]','Stack. Imprime 1 lado. Placa 0.112 in.'),
('imp2','impresion','Impresora 2','Flexotec','Activa',120,8,120,123,2,'[{"rep":40,"cant":7},{"rep":50,"cant":7},{"rep":60,"cant":7},{"rep":70,"cant":7},{"rep":90}]','Stack. Frente y vuelta. Placa 0.045 in. Rodillo de 90 sin cantidad en la hoja.'),
('imp3','impresion','Impresora 3','Indemo','Activa',130,4,77,80,2,'[{"rep":25,"cant":4},{"rep":30,"cant":4},{"rep":35,"cant":4},{"rep":40,"cant":4},{"rep":45,"cant":4},{"rep":46,"cant":4},{"rep":50,"cant":4},{"rep":55,"cant":4},{"rep":60,"cant":4},{"rep":62,"cant":4}]','Stack chica. Frente y vuelta. Placa 0.112 in.'),
('imp4','impresion','Impresora 4','Hemingston','Activa',140,6,120,132,2,'[{"rep":50,"cant":6},{"rep":60,"cant":6},{"rep":70,"cant":6},{"rep":80,"cant":6},{"rep":90,"cant":4},{"rep":100,"cant":4}]','Stack. Placa 0.045 in.'),
('imp5','impresion','Impresora 5','Comexi','Activa',150,4,82,85,2,'[{"rep":30,"cant":4},{"rep":35,"cant":4},{"rep":40,"cant":4},{"rep":43,"cant":4},{"rep":45,"cant":4},{"rep":50,"cant":4},{"rep":55,"cant":4},{"rep":60,"cant":4},{"rep":70,"cant":4},{"rep":80,"cant":4},{"rep":90,"cant":4},{"rep":100,"cant":4}]','Stack. Frente y vuelta. Placa 0.112 in.')
on conflict (id) do nothing;

-- Bolseo
insert into public.maquinas (id,tipo,nombre,marca,estado,orden,carriles,carriles_max,sellos,sin_fotocelda,notas) values
('bol1','bolseo','Bolseadora 1','Especial (pouch con zipper)','Activa',210,1,null,'{pouch}',false,'Pouch con zipper / ziploc'),
('bol2','bolseo','Bolseadora 2','Chovyting (china)','Activa',220,1,null,'{lateral}',false,'Multifunción. Confirmar modelo en la placa.'),
('bol3','bolseo','Bolseadora 3','Genesis','Activa',230,2,null,'{fondo,lateral}',false,'Cambio de barra para fondo o lateral'),
('bol4','bolseo','Bolseadora 4','Hemingston','Activa',240,2,null,'{camiseta}',false,null),
('bol5','bolseo','Bolseadora 5','Genesis','Activa',250,2,null,'{fondo}',false,null),
('bol6','bolseo','Bolseadora 6','Roan','Activa',260,2,null,'{lateral}',false,null),
('bol7','bolseo','Bolseadora 7','Roan','Activa',270,2,null,'{lateral}',false,null),
('bol8','bolseo','Bolseadora 8','Amplas','Activa',280,1,3,'{fondo}',true,'Sin fotocelda: solo repetición continua. Hasta 3 carriles según la medida.'),
('bol9','bolseo','Bolseadora 9','China','Activa',290,1,null,'{fondo}',false,null),
('bol10','bolseo','Bolseadora 10','Coreana','Activa',300,1,null,'{fondo}',false,'Medidas chicas. Sello redondo: automático hasta 35, manual hasta 70. Podría correr 2 carriles con otra fotocelda y rodillos nuevos.')
on conflict (id) do nothing;

-- Acabado
insert into public.maquinas (id,tipo,nombre,marca,estado,orden,ancho_max,notas) values
('ref1','acabado','Refiladora','Por confirmar','Activa',410,123,'10 cuchillas'),
('lam1','acabado','Laminadora','Sinomec','Activa',420,null,'Solventless. Rodillos de laminación: 30, 40, 50, 60, 70, 80, 100.')
on conflict (id) do nothing;

-- Materiales típicos (ajusta nombres, saco y mínimos a tu bodega)
insert into public.materiales (nombre,categoria,kg_por_saco,minimo_kg) values
('PEBD virgen','resina',25,2000),
('PEBD reciclado','reciclado',25,1000),
('PEAD virgen','resina',25,1000),
('LLDPE','resina',25,1000),
('Masterbatch / pigmento','masterbatch',25,100),
('Aditivo (deslizante / antibloqueo)','aditivo',25,50)
on conflict (nombre) do nothing;
