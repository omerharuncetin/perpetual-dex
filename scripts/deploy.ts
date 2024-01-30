import { ethers } from "hardhat";

async function main() {
  const token = await ethers.deployContract("Token");
  await token.waitForDeployment();

  const rewardToken = await ethers.deployContract("RewardToken");
  await rewardToken.waitForDeployment();

  const tokenAddress = await token.getAddress();
  const rewardTokenAddress = await rewardToken.getAddress();

  const rewardContract = await ethers.deployContract("RewardContract", [
    rewardTokenAddress,
  ]);
  await rewardContract.waitForDeployment();

  const rewardContractAddress = await rewardContract.getAddress();

  const dex = await ethers.deployContract("PerpetualDEX", [
    tokenAddress,
    rewardContractAddress,
  ]);
  await dex.waitForDeployment();

  const dexAddress = await dex.getAddress();

  const tx = await rewardContract.setDEXContractAddress(dexAddress);
  await tx.wait();

  console.log("Token address: ", tokenAddress);
  console.log("Reward token address: ", rewardTokenAddress);
  console.log("DEX address: ", dexAddress);
  console.log("Reward contract address: ", rewardContractAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
