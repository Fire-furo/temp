.PHONY: start backend frontend ml mongodb

start:
	@make -j 4 ml mongodb backend frontend

ml:
	@cd ml-service && python -m venv .venv
	@cd ml-service && .venv/bin/pip install -r requirements.txt
	@cd ml-service && .venv/bin/python train_model.py
	@cd ml-service && .venv/bin/uvicorn app:app --host 0.0.0.0 --port 8000

mongodb:
	@docker run -p 27017:27017 mongo 

backend:
	@cd backend && npm install
	@cd backend && npm run dev

frontend:
	@cd frontend && npm install
	@cd frontend && npm run dev
