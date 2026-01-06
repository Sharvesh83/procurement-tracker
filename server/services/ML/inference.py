import sys
import json
import pandas as pd
from model_loader import load_model

def main():
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({"error": "No input data received"}))
            sys.exit(1)
            
        data = json.loads(input_data)
        
        # Convert to DataFrame
        df = pd.DataFrame(data)
        
        # Load Model
        model = load_model()
        
        # Predict
        predictions = model.predict(df)
        
        # Return merged results
        # We assume the order is preserved, so we can zip input with output
        # Or just return the predictions and let Node merge them.
        # Ideally, we return the minimal needed info or the enriched records.
        # Let's return the simplified list of risk objects
        
        print(json.dumps(predictions))
        
    except Exception as e:
        error_msg = {"error": str(e)}
        print(json.dumps(error_msg))
        sys.exit(1)

if __name__ == "__main__":
    main()
