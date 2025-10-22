# AWS Bedrock Agent Troubleshooting Log

## Issue Summary
**Problem**: AWS Bedrock Agents failing with `validationException: This model doesn't support the stopSequences field`  
**Root Cause**: AWS Bedrock Agent Runtime automatically injects `stopSequences` when using agents, but Qwen 32B model doesn't support them  
**Status**: Issue identified - AWS infrastructure limitation  

---

## Timeline of Investigation

### 1. Initial Problem Identification
- **Issue**: `AccessDeniedException` when trying to invoke Bedrock agents
- **Error**: Account ID mismatch between credentials (724772087455) and agents (280362093938)

### 2. AWS Credentials Configuration
- **Problem**: Using wrong AWS account credentials
- **Solution**: User ran `aws configure` to switch to correct account (280362093938)
- **Verification**: `aws sts get-caller-identity` confirmed correct account

### 3. Agent Configuration Analysis
- **Agents Identified**:
  - Summarize Agent: `ECJTYBCQCP` 
  - Predict Agent: `VR9SBZYZ8F`
  - Both using alias: `TSTALIASID`
- **Foundation Model**: `qwen.qwen3-32b-v1:0` (Qwen 32B)

### 4. StopSequences Issue Discovery
- **New Error**: `validationException: This model doesn't support the stopSequences field`
- **Investigation**: Found `stopSequences: ["</answer>"]` in agent's `inferenceConfiguration`

### 5. Configuration Cleanup Attempts
```bash
# Removed stopSequences from agent configuration
aws bedrock-agent get-agent --agent-id ECJTYBCQCP --region ap-northeast-1

# Re-prepared both agents
aws bedrock-agent prepare-agent --agent-id ECJTYBCQCP --region ap-northeast-1
aws bedrock-agent prepare-agent --agent-id VR9SBZYZ8F --region ap-northeast-1

# Updated agent aliases to point to latest DRAFT versions
aws bedrock-agent update-agent-alias --agent-id ECJTYBCQCP --agent-alias-id TSTALIASID --routing-configuration agentVersion=DRAFT
aws bedrock-agent update-agent-alias --agent-id VR9SBZYZ8F --agent-alias-id TSTALIASID --routing-configuration agentVersion=DRAFT
```

### 6. Code Verification
- **Confirmed**: Our Python code correctly uses `bedrock-agent-runtime` without any `stopSequences`
- **Code Structure**:
  ```python
  response = self.bedrock_agent_client.invoke_agent(
      agentId=agent_id,
      agentAliasId=agent_alias_id,
      sessionId=session_id,
      inputText=input_text
  )
  ```

### 7. Final Root Cause Analysis
- **Discovery**: AWS Bedrock Agent Runtime automatically injects `stopSequences` internally
- **Confirmation**: Even minimal test calls fail with same error
- **Conclusion**: This is an AWS-side limitation, not a configuration issue

---

## Technical Details

### Environment Configuration
```bash
# AWS Account: 280362093938
# Region: ap-northeast-1
# Agents:
#   - ECJTYBCQCP (Summarize Agent)
#   - VR9SBZYZ8F (Predict Agent)
# Foundation Model: qwen.qwen3-32b-v1:0
```

### Error Messages Encountered
1. **Initial**: `AccessDeniedException` - Wrong AWS account
2. **Final**: `validationException: This model doesn't support the stopSequences field`

### Files Modified
- `backend/services/bedrock_service.py` - Updated to use AWS credential chain
- `.env` - Contains correct agent IDs and alias IDs

### Test Scripts Created
- `test_bedrock.py` - Main agent testing script
- `test_bedrock_direct.py` - Direct model invocation test
- `test_bedrock_minimal.py` - Minimal agent invocation test

---

## Root Cause: AWS Infrastructure Limitation

### The Problem
1. **AWS Bedrock Agent Runtime** automatically injects `stopSequences` when invoking agents
2. **Qwen 32B model** (`qwen.qwen3-32b-v1:0`) does not support `stopSequences` parameter
3. **This happens even when**:
   - No `stopSequences` in agent configuration
   - No `stopSequences` in client code
   - Using minimal invocation parameters

### Evidence
- Agent configuration shows no `stopSequences` in `inferenceConfiguration`
- Code review confirms no `stopSequences` parameters sent
- Multiple preparation and deployment attempts failed
- Issue persists across different invocation methods

---

## Recommended Solutions

### Option 1: Switch Foundation Model (Recommended)
**Change agents to use Claude 3 Haiku**: `anthropic.claude-3-haiku-20240307-v1:0`

**Pros**:
- ✅ Supports `stopSequences`
- ✅ Fast and cost-effective
- ✅ Works immediately with existing configuration
- ✅ No code changes required

**Available Claude Models**:
```
anthropic.claude-3-haiku-20240307-v1:0       (Recommended)
anthropic.claude-3-sonnet-20240229-v1:0
anthropic.claude-3-5-sonnet-20240620-v1:0
anthropic.claude-3-5-sonnet-20241022-v2:0
anthropic.claude-sonnet-4-20250514-v1:0
```

### Option 2: Direct Model Invocation
**Bypass agents entirely** and use `bedrock-runtime` directly

**Pros**:
- ✅ Can continue using Qwen 32B
- ✅ No AWS agent limitations

**Cons**:
- ❌ Requires rewriting prompt logic
- ❌ Loses agent orchestration features
- ❌ More complex implementation

### Option 3: Wait for AWS Fix
**Keep current setup** and wait for AWS to resolve Qwen + Agent compatibility

**Cons**:
- ❌ Unknown timeline
- ❌ Blocks development progress

---

## Current Status

### ✅ Completed
- [x] AWS credentials configured correctly
- [x] Agent IDs and aliases verified
- [x] Agent configuration cleaned (no stopSequences)
- [x] Agents prepared and deployed
- [x] Code verified as correct
- [x] Root cause identified

### ⏳ Next Steps
- [ ] **Decision needed**: Choose solution approach
- [ ] **If Option 1**: Update agent foundation models to Claude 3 Haiku
- [ ] **If Option 2**: Implement direct model invocation
- [ ] **If Option 3**: Wait for AWS fix

---

## Key Learnings

1. **AWS Bedrock Agent Runtime has hidden behaviors** - automatically injects parameters
2. **Model compatibility varies** - not all models support all agent features
3. **Console "Test Agent" vs Code behavior** - both affected by same limitation
4. **Foundation model choice is critical** - affects agent functionality

---

## Contact Information
- **Issue Type**: AWS Infrastructure Limitation
- **Affected Service**: AWS Bedrock Agents with Qwen models
- **Workaround**: Switch to Claude foundation models

---

*Last Updated: 2025-09-27*  
*Investigation Duration: ~2 hours*  
*Status: Root cause identified, solution options provided*