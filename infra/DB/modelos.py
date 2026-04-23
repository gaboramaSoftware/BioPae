#reescribir en C

from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, Date, DateTime, Enum, Time, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Usuario(Base):
    __tablename__ = "usuarios"
    
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, index=True)
    rut = Column(String(12), unique=True, index=True)
    es_pae = Column(Boolean, default=False)
    observaciones = Column(String(1000), nullable=True)

    curso_id = Column(Integer, ForeignKey("cursos.id"), index=True)
    estado_id = Column(Integer, ForeignKey("estados_estudiante.id"), index=True)
    
    # Relaciones
    curso = relationship("Curso", back_populates="usuarios")
    estado = relationship("EstadoEstudiante", back_populates="usuarios")
    huella = relationship("Huella", back_populates="propietario", uselist=False) # uselist=False para 1:1
    registros = relationship("Registro", back_populates="usuario")
    tickets = relationship("Ticket", back_populates="usuario")

class EstadoEstudiante(Base):
    __tablename__ = "estados_estudiante"
    id = Column(Integer, primary_key=True, index=True)
    nombre_estado = Column(String, unique=True)
    usuarios = relationship("Usuario", back_populates="estado")

class Huella(Base):
    __tablename__ = "huellas"
    id = Column(Integer, primary_key=True, index=True)
    huella_blob = Column(String) 
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), unique=True)
    propietario = relationship("Usuario", back_populates="huella")

class Curso(Base):
    __tablename__ = "cursos"
    id = Column(Integer, primary_key=True, index=True)
    numero = Column(Integer, nullable=True)   # 1-8 para Basico, 1-4 para Medio, None para Kinder/Pre-Kinder
    nivel = Column(String(20))                # "Basico", "Medio", "Kinder", "Pre-Kinder"
    letra = Column(String(2))
    usuarios = relationship("Usuario", back_populates="curso")

class Totem(Base): # Corregido a PascalCase
    __tablename__ = "totems"
    id = Column(Integer, primary_key=True, index=True)
    ubicacion = Column(Enum("Basica", "Media", name="ubicacion_totem_enum"))
    registros = relationship("Registro", back_populates="totem")

class Registro(Base): # Singular es mejor práctica
    __tablename__ = "registros"
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), index=True)
    totem_id = Column(Integer, ForeignKey("totems.id"), index=True) # Ahora sí linkeado
    fecha = Column(Date)
    hora = Column(Time) # Usar Time para la hora, DateTime incluye fecha
    estado_registro = Column(Enum("Aprobado", "Rechazado", name="estado_registro_enum")) 
    tipo_solicitud = Column(Enum("desayuno", "almuerzo", name="tipo_solicitud_enum")) 

    usuario = relationship("Usuario", back_populates="registros")
    totem = relationship("Totem", back_populates="registros")
    ticket = relationship("Ticket", back_populates="registro", uselist=False) # 1:1 con el ticket que generó

class AdminConfig(Base):
    __tablename__ = "admin_config"
    id = Column(Integer, primary_key=True)
    rut = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)

class RacionesConfig(Base):
    __tablename__ = "raciones_config"
    id = Column(Integer, primary_key=True)
    tipo = Column(String(20), unique=True, nullable=False)  # "desayuno" o "almuerzo"
    total = Column(Integer, default=0, nullable=False)      # 0 = sin límite configurado

class Ticket(Base):
    __tablename__ = "tickets"
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), index=True)
    registro_id = Column(Integer, ForeignKey("registros.id"), unique=True) # El link crucial
    tipo_ticket = Column(Enum("desayuno", "almuerzo", name="tipo_ticket_enum")) 
    fecha_emision = Column(Date)
    hora_emision = Column(Time)

    # Sin restricción única: el límite se maneja en la lógica de negocio (RegistrosController)

    usuario = relationship("Usuario", back_populates="tickets")
    registro = relationship("Registro", back_populates="ticket")