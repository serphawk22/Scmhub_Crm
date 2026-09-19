with open('main.py', 'r') as f:
    content = f.read()

endpoint_code = """
@app.get("/users/{user_id}/stats")
def get_user_stats(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Sales team stats
    if user.role in ["Admin", "SalesManager", "Employee"]:
        # Clients handling
        clients_count = len(session.exec(select(ClientProfile).where(ClientProfile.assignedEmployeeId == user.id)).all())
        
        # Leads converted
        converted_leads_count = len(session.exec(select(Lead).where(Lead.owner_id == user.id, Lead.is_converted == True)).all())
        
        # Current active tasks
        active_tasks = session.exec(select(Task).where(Task.assigned_to == user.id, Task.status != "Done")).all()
        
        return {
            "type": "sales",
            "clients_handling": clients_count,
            "leads_converted": converted_leads_count,
            "active_tasks": [
                {"id": t.id, "title": t.title, "status": t.status, "priority": t.priority} 
                for t in active_tasks
            ]
        }
        
    # Dev team stats
    elif user.role in ["ProjectMember", "Intern"]:
        if not user.name:
            tickets = []
        else:
            tickets = session.exec(select(ProjectTicket).where(ProjectTicket.current_owner == user.name)).all()
            
        total_tickets = len(tickets)
        in_dev = sum(1 for t in tickets if t.current_state == "In Dev")
        in_qa = sum(1 for t in tickets if t.current_state == "Given to QA")
        in_prod = sum(1 for t in tickets if t.current_state == "Prod Release")
        
        return {
            "type": "dev",
            "total_tickets": total_tickets,
            "in_dev": in_dev,
            "in_qa": in_qa,
            "in_prod": in_prod
        }
        
    return {"type": "unknown"}
"""

if "/users/{user_id}/stats" not in content:
    content = content.replace(
        '@app.delete("/users/{user_id}")',
        endpoint_code + '\n\n@app.delete("/users/{user_id}")'
    )
    with open('main.py', 'w') as f:
        f.write(content)
    print("Added /users/{user_id}/stats endpoint")
else:
    print("Endpoint already exists")
