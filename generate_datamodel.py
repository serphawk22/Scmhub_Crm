import os
import sys
from sqlalchemy import create_engine, inspect

db_url = "sqlite:///database.db"
engine = create_engine(db_url)
inspector = inspect(engine)

artifact_path = "/Users/apple/.gemini/antigravity-ide/brain/ce00a0c2-ce93-4dc4-a712-572286a201d6/datamodel.md"

def generate_mermaid_er(inspector):
    tables = inspector.get_table_names()
    mermaid = ["```mermaid", "erDiagram"]
    
    for table in tables:
        columns = inspector.get_columns(table)
        fks = inspector.get_foreign_keys(table)
        
        # Add table definition
        mermaid.append(f"    {table} {{")
        for col in columns:
            col_type = str(col['type']).split('(')[0]
            col_name = col['name']
            # Clean col_type for mermaid compatibility
            col_type = "".join(e for e in col_type if e.isalnum())
            if not col_type:
                col_type = "TYPE"
            mermaid.append(f"        {col_type} {col_name}")
        mermaid.append("    }")
        
        # Add relationships based on foreign keys
        for fk in fks:
            referred_table = fk['referred_table']
            mermaid.append(f"    {referred_table} ||--o{{ {table} : \"{fk['constrained_columns'][0]}\"")
            
    mermaid.append("```")
    return "\n".join(mermaid)

def generate_markdown_doc(inspector):
    tables = inspector.get_table_names()
    doc = ["# SerpHawk CRM Complete Data Model\n"]
    doc.append("This document outlines the complete data model for the SerpHawk CRM, detailing all entities, properties, and relationships that drive the multi-tenant SaaS architecture, AI agents, and various operational workflows.\n")
    
    doc.append("## Entity-Relationship Diagram\n")
    doc.append(generate_mermaid_er(inspector))
    doc.append("\n## Table Definitions\n")
    
    for table in tables:
        doc.append(f"### `{table}`")
        columns = inspector.get_columns(table)
        
        doc.append("| Column | Type | Nullable | Default |")
        doc.append("| --- | --- | --- | --- |")
        for col in columns:
            ctype = str(col['type']).split('(')[0]
            cnull = "Yes" if col['nullable'] else "No"
            cdef = col.get('default') or "None"
            doc.append(f"| `{col['name']}` | {ctype} | {cnull} | {cdef} |")
        doc.append("\n")
        
    return "\n".join(doc)

if __name__ == "__main__":
    content = generate_markdown_doc(inspector)
    with open(artifact_path, "w") as f:
        f.write(content)
    print("Data model generated.")
