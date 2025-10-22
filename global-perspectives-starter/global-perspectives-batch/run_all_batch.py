#!/usr/bin/env python3
"""
Master batch runner for AWS Bedrock AI processing pipeline.
Orchestrates: summarization -> predictions -> analysis
"""

import asyncio
import subprocess
import sys
import datetime
from pathlib import Path

async def run_script(script_name: str, description: str):
    """Run a batch script and handle errors gracefully."""
    print(f"\n{'='*60}")
    print(f"🚀 Starting {description}")
    print(f"{'='*60}")
    
    try:
        # Run the script using subprocess
        result = subprocess.run([
            sys.executable, script_name
        ], cwd=Path(__file__).parent, capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"✅ {description} completed successfully")
            if result.stdout:
                print("Output:", result.stdout)
        else:
            print(f"❌ {description} failed with return code {result.returncode}")
            if result.stderr:
                print("Error:", result.stderr)
            if result.stdout:
                print("Output:", result.stdout)
            return False
            
    except Exception as e:
        print(f"❌ {description} failed with exception: {e}")
        return False
    
    return True

async def main():
    """Run the complete AWS Bedrock AI processing pipeline."""
    start_time = datetime.datetime.now()
    print(f"🌍 Global Perspectives - AWS Bedrock AI Pipeline")
    print(f"⏰ Started at: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Define the processing pipeline
    pipeline = [
        ("summarize_batch.py", "Article Summarization (AWS Bedrock LLaMA)"),
        ("predict_batch.py", "Conflict Predictions (AWS Bedrock LLaMA)")
    ]
    
    success_count = 0
    
    for script, description in pipeline:
        success = await run_script(script, description)
        if success:
            success_count += 1
        else:
            print(f"\n⚠️  Pipeline interrupted at {description}")
            break
    
    # Summary
    end_time = datetime.datetime.now()
    duration = end_time - start_time
    
    print(f"\n{'='*60}")
    print(f"📊 Pipeline Summary")
    print(f"{'='*60}")
    print(f"✅ Completed: {success_count}/{len(pipeline)} stages")
    print(f"⏱️  Duration: {duration}")
    print(f"🏁 Finished at: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    if success_count == len(pipeline):
        print(f"🎉 All AWS Bedrock AI processing completed successfully!")
        
        # Show output files
        today = datetime.date.today().isoformat()
        data_dir = Path("data")
        output_files = [
            f"summaries_{today}.json",
            f"predictions_{today}.json"
        ]
        
        print(f"\n📁 Generated files:")
        for file in output_files:
            file_path = data_dir / file
            if file_path.exists():
                size = file_path.stat().st_size
                print(f"   • {file} ({size:,} bytes)")
            else:
                print(f"   • {file} (not found)")
    else:
        print(f"⚠️  Pipeline completed with errors. Check logs above.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())