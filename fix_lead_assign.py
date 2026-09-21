import re

with open("main.py", "r") as f:
    content = f.read()

route_code = """
@app.post("/leads/{lead_id}/assign-employee")
def assign_employee_lead(
    lead_id: int, body: AssignEmployeeRequest, session: Session = Depends(get_session)
):
    lead = session.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead.owner_id = body.employee_id
    session.add(lead)
    session.commit()
    return {"ok": True}
"""

if "@app.post(\"/leads/{lead_id}/assign-employee\")" not in content:
    # Find a good place to insert, like before GET /leads/{lead_id} or just after the clients assign-employee
    content = content.replace(
        '@app.post("/clients/{client_id}/assign-employee")',
        route_code + '\n\n@app.post("/clients/{client_id}/assign-employee")'
    )
    with open("main.py", "w") as f:
        f.write(content)
    print("Added /leads/{lead_id}/assign-employee route")
else:
    print("Route already exists")
