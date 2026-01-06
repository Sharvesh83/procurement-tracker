import numpy as np
import pandas as pd

class RiskModel:
    def __init__(self):
        # Heuristic Weights (simulated ML coefficients)
        self.weights = {
            'high_amount': 0.3,
            'outlier': 0.4,
            'suspicious_pattern': 0.3
        }
    
    def predict(self, records_df):
        """
        Input: Pandas DataFrame
        Output: DataFrame with 'risk_score', 'risk_label', 'risk_flags'
        """
        results = []
        
        # 1. Pre-calculate batch stats for outlier detection
        if not records_df.empty:
            mean_amt = records_df['awarded_amt'].mean()
            std_amt = records_df['awarded_amt'].std()
            if np.isnan(std_amt): std_amt = 0
            
            # Simple per-record analysis
            for index, row in records_df.iterrows():
                score = 0
                flags = []
                
                amount = float(row.get('awarded_amt', 0))
                
                # --- FACTOR 1: Absolute High Value ---
                if amount > 10000000:
                    score += 0.4
                    flags.append('Very High Value (>10M)')
                elif amount > 1000000:
                    score += 0.2
                    flags.append('High Value (>1M)')
                    
                # --- FACTOR 2: Statistical Outlier (within this batch) ---
                # Z-Score approach
                if std_amt > 0:
                    z_score = (amount - mean_amt) / std_amt
                    if z_score > 3:
                        score += 0.4
                        flags.append(f'Statistical Outlier (Z={z_score:.1f})')
                    elif z_score > 2:
                        score += 0.2
                        flags.append('Moderate Deviation')
                        
                # --- FACTOR 3: Suspicious Patterns ---
                # Round number check
                if amount > 1000 and amount % 1000 == 0:
                    score += 0.2
                    flags.append('Round Number Amount')
                    
                # Status check
                status = str(row.get('tender_detail_status', '')).lower()
                if 'fail' in status or 'cancel' in status or 'retender' in status:
                    score += 0.5
                    flags.append('Abnormal Tender Status')

                # Cap Score at 1.0
                final_score = min(score, 1.0)
                
                # Labeling
                if final_score >= 0.7:
                    label = 'High'
                elif final_score >= 0.3:
                    label = 'Medium'
                else:
                    label = 'Low'
                    
                results.append({
                    'risk_score': round(final_score, 2),
                    'risk_level': label,
                    'risk_flags': flags
                    # Priority wil be set after batch processing
                })

        # --- 80/20 Prioritization (Ranking-based) ---
        if results:
            # 1. Extract scores
            scores = [r['risk_score'] for r in results]
            # 2. Calculate 80th percentile threshold
            threshold = np.percentile(scores, 80)
            
            # 3. Assign Priority
            for res in results:
                # If score >= threshold and score > 0 (to avoid marking all 0s as high if all are 0)
                if res['risk_score'] >= threshold and res['risk_score'] > 0:
                    res['priority'] = 'High'
                else:
                    res['priority'] = 'Normal'
        
        return results

    def predict_single(self, record):
        # Wrapper for single record if needed
        df = pd.DataFrame([record])
        return self.predict(df)[0]
