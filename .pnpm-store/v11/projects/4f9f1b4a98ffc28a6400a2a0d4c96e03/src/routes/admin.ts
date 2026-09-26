import { Router } from 'express';
import { z } from 'zod';
import { execFile } from 'node:child_process';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { join, resolve, sep } from 'node:path';
import { prisma } from '../lib/prisma';
import { allow, scopeBranch } from '../middleware/auth';
const r=Router();
const execFileAsync=promisify(execFile);
const pageArgs = (req:any) => ({ skip: Math.max(0, (Number(req.query.page || 1)-1)*Number(req.query.limit || 20)), take: Math.min(100, Number(req.query.limit || 20)) });
const audit = async (userId:string, action:string, module:string, recordId?:string, details?:any) => prisma.auditLog.create({ data:{ userId, action, module, recordId, details } });

r.get('/dashboard', async (req,res) => {
  if(req.user!.role==='CAMIONERO'){
    const [pending,today,completed]=await Promise.all([
      prisma.delivery.count({where:{driverId:req.user!.driverId,status:{in:['PENDIENTE','ASIGNADA','EN_CAMINO']}}}),
      prisma.delivery.count({where:{driverId:req.user!.driverId,scheduledAt:{gte:new Date(new Date().setHours(0,0,0,0))}}}),
      prisma.delivery.count({where:{driverId:req.user!.driverId,status:'ENTREGADA'}})
    ]);
    return res.json({driver:{pending,today,completed}});
  }
  const branchId=scopeBranch(req);const branchFilter=branchId?{branchId}:{};
  const today=new Date();today.setHours(0,0,0,0);const month=new Date(today.getFullYear(),today.getMonth(),1);
  const [salesDay,salesMonth,purchasesMonth,expensesMonth,products,customers,suppliers,lowStock,deliveries,cash,branches]=await Promise.all([
    prisma.sale.aggregate({where:{...branchFilter,createdAt:{gte:today},status:{not:'ANULADA'}},_sum:{total:true}}),
    prisma.sale.aggregate({where:{...branchFilter,createdAt:{gte:month},status:{not:'ANULADA'}},_sum:{total:true}}),
    prisma.purchase.aggregate({where:{...branchFilter,createdAt:{gte:month},status:{not:'ANULADA'}},_sum:{total:true}}),
    prisma.expense.aggregate({where:{...branchFilter,createdAt:{gte:month}},_sum:{amount:true}}),
    prisma.product.count({where:{active:true}}),prisma.customer.count({where:{active:true}}),prisma.supplier.count({where:{active:true}}),
    prisma.inventory.findMany({where:{...(branchId?{branchId}:{}),quantity:{lte:0}},include:{product:true,branch:true},take:8}),
    prisma.delivery.groupBy({by:['status'],where:branchFilter,_count:true}),
    prisma.cashRegister.findFirst({where:{...branchFilter,closedAt:null},orderBy:{openedAt:'desc'}}),
    prisma.branch.findMany({where:{active:true},include:{inventories:{select:{quantity:true}}}})
  ]);
  const salesSeries=await prisma.sale.findMany({where:{...branchFilter,createdAt:{gte:new Date(Date.now()-7*86400000)},status:{not:'ANULADA'}},select:{createdAt:true,total:true},orderBy:{createdAt:'asc'}});
  res.json({salesToday:Number(salesDay._sum.total||0),salesMonth:Number(salesMonth._sum.total||0),purchasesMonth:Number(purchasesMonth._sum.total||0),expensesMonth:Number(expensesMonth._sum.amount||0),estimatedProfit:Number(salesMonth._sum.total||0)-Number(purchasesMonth._sum.total||0)-Number(expensesMonth._sum.amount||0),products,customers,suppliers,lowStock,deliveries:Object.fromEntries(deliveries.map(x=>[x.status,x._count])),cash:cash?{opening:cash.opening,openedAt:cash.openedAt}:null,branches:branches.map(b=>({id:b.id,name:b.name,stock:b.inventories.reduce((n,i)=>n+Number(i.quantity),0)})),salesSeries:salesSeries.map(s=>({date:s.createdAt,total:Number(s.total)}))});
});
r.get('/audit',allow('audit.view'),async(req,res)=>res.json(await prisma.auditLog.findMany({include:{user:{select:{name:true,username:true}}},orderBy:{createdAt:'desc'},...pageArgs(req)})));
r.get('/settings',allow('settings.view'),async(_req,res)=>res.json(await prisma.companySettings.upsert({where:{id:'default'},create:{id:'default'},update:{}})));
r.patch('/settings',allow('settings.edit'),async(req,res)=>{const d=z.object({name:z.string().min(2).optional(),nit:z.string().optional(),phone:z.string().optional(),email:z.string().email().optional().or(z.literal('')),address:z.string().optional(),currency:z.string().optional(),taxRate:z.coerce.number().min(0).max(100).optional()}).parse(req.body);const normalized={...d,email:d.email===''?null:d.email};const settings=await prisma.companySettings.upsert({where:{id:'default'},create:{id:'default',...normalized},update:normalized});await audit(req.user!.id,'MODIFICAR','settings','default',d);res.json(settings);});
r.get('/backups',async(req,res)=>{if(req.user!.role!=='ADMIN')return res.status(403).json({message:'Solo el administrador puede acceder a los respaldos.'});const folder=resolve(process.cwd(),'backups');await mkdir(folder,{recursive:true});const files=await readdir(folder);const items=await Promise.all(files.filter(f=>f.endsWith('.dump')).map(async file=>{const info=await stat(join(folder,file));return{name:file,size:info.size,createdAt:info.mtime};}));res.json(items.sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()));});
r.post('/backups',async(req,res)=>{if(req.user!.role!=='ADMIN')return res.status(403).json({message:'Solo el administrador puede crear respaldos.'});if(!process.env.DATABASE_URL)return res.status(503).json({message:'Configura DATABASE_URL para respaldar la base de datos.'});const folder=resolve(process.cwd(),'backups');await mkdir(folder,{recursive:true});const filename=`ferroerp-${new Date().toISOString().replace(/[:.]/g,'-')}.dump`;const target=join(folder,filename);try{await execFileAsync(process.env.PG_DUMP_PATH||'pg_dump',['--format=custom',`--file=${target}`,`--dbname=${process.env.DATABASE_URL}`],{timeout:120000});await audit(req.user!.id,'CREAR_RESPALDO','backups',filename);res.status(201).json({name:filename,message:'Respaldo creado correctamente.'});}catch(error:any){console.error('pg_dump failed',error.message);res.status(503).json({message:'No se pudo crear el respaldo. Comprueba que pg_dump esté instalado y la base de datos responda.'});}});
r.get('/backups/:name/download',async(req,res)=>{if(req.user!.role!=='ADMIN')return res.status(403).json({message:'Solo el administrador puede descargar respaldos.'});const name=String(req.params.name);if(!/^ferroerp-[\w-]+\.dump$/.test(name))return res.status(400).json({message:'Nombre de respaldo no válido.'});const folder=resolve(process.cwd(),'backups');const target=resolve(folder,name);if(!target.startsWith(folder+sep))return res.status(400).json({message:'Ruta de archivo no válida.'});res.download(target,name,error=>{if(error&&!res.headersSent)res.status(404).json({message:'No encontramos ese respaldo.'});});});
export default r;
