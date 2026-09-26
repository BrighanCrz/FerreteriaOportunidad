import { Router } from 'express';
import catalog from './catalog';
import people from './people';
import transactions from './transactions';
import finance from './finance';
import admin from './admin';

const router=Router();
const blockDriver=(req:any,res:any,next:any)=>req.user?.role==='CAMIONERO'?res.status(403).json({message:'Este módulo no está disponible para el panel de camionero.'}):next();
router.use(['/branches','/products','/categories','/inventory','/customers','/suppliers','/users','/sales','/purchases','/movements','/transfers','/drivers','/cash','/expenses','/wood','/reports','/audit','/settings','/backups','/search'],blockDriver);
router.use(catalog,people,transactions,finance,admin);
export default router;
