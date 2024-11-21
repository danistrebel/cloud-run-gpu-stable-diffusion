FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV FLASK_APP=main.py
ENV FLASK_RUN_HOST=0.0.0.0
ENV PORT=8080

EXPOSE ${PORT}

ENTRYPOINT ["sh", "-c", "flask run --host=0.0.0.0 --port=${PORT}"] 
