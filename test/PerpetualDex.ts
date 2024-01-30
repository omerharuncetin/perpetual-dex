import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { formatPosition } from "../test-helpers/format-position";
import { PositionType, FixtureData } from "../test-helpers/models";

describe("PerpetualDex", function () {
  async function deployPerpetualDexFixture() {
    // Deploys the trading token contract
    const token = await ethers.deployContract("Token");
    await token.waitForDeployment();

    // Deploys the reward token contract
    const rewardToken = await ethers.deployContract("RewardToken");
    await rewardToken.waitForDeployment();
    const tokenAddress = await token.getAddress();
    const rewardTokenAddress = await rewardToken.getAddress();

    // Deploys the reward contract
    const rewardContract = await ethers.deployContract("RewardContract", [
      rewardTokenAddress,
    ]);
    await rewardContract.waitForDeployment();

    const rewardContractAddress = await rewardContract.getAddress();

    // Deploys the dex contract
    const dex = await ethers.deployContract("PerpetualDEX", [
      tokenAddress,
      rewardContractAddress,
    ]);
    await dex.waitForDeployment();

    const dexAddress = await dex.getAddress();

    const tx = await rewardContract.setDEXContractAddress(dexAddress);
    await tx.wait();

    // Contracts are deployed using the first signer/account by default
    const [
      owner,
      traderOne,
      traderTwo,
      traderThree,
      traderFour,
    ] = await ethers.getSigners();

    // Transfer trading tokens to traders
    const amount = ethers.parseEther("1000000");
    const traderOneTokenTx = await token.transfer(traderOne.address, amount);
    await traderOneTokenTx.wait();

    const traderTwoTokenTx = await token.transfer(traderFour.address, amount);
    await traderTwoTokenTx.wait();

    const traderThreeTokenTx = await token.transfer(
      traderThree.address,
      amount
    );
    await traderThreeTokenTx.wait();

    const traderFourTokenTx = await token.transfer(traderTwo.address, amount);
    await traderFourTokenTx.wait();

    // transfer reward token to reward contract
    await rewardToken.transfer(
      rewardContractAddress,
      ethers.parseEther("10000000") //  10 million
    );

    // set token allowances for traders on dex
    const traderOneApproveTx = await token
      .connect(traderOne)
      .approve(dexAddress, amount);
    await traderOneApproveTx.wait();
    const traderTwoApproveTx = await token
      .connect(traderTwo)
      .approve(dexAddress, amount);
    await traderTwoApproveTx.wait();
    const traderThreeApproveTx = await token
      .connect(traderThree)
      .approve(dexAddress, amount);
    await traderThreeApproveTx.wait();
    const traderFourApproveTx = await token
      .connect(traderFour)
      .approve(dexAddress, amount);
    await traderFourApproveTx.wait();

    return {
      dex,
      token,
      rewardToken,
      rewardContract,
      owner,
      traderOne,
      traderTwo,
      traderThree,
      traderFour,
    };
  }

  describe("Deployment", function () {
    it("Should set the right token address", async function () {
      const { dex, token } = await loadFixture(deployPerpetualDexFixture);

      const tokenAddress = await token.getAddress();

      expect(await dex.getTokenAddress()).to.equal(tokenAddress);
    });

    it("Should set the right reward contract address", async function () {
      const { dex, rewardContract } = await loadFixture(
        deployPerpetualDexFixture
      );

      const rewardContractAddress = await rewardContract.getAddress();

      expect(await dex.getRewardContractAddress()).to.equal(
        rewardContractAddress
      );
    });

    it("Should set the right owner address", async function () {
      const { dex, owner } = await loadFixture(deployPerpetualDexFixture);

      expect(await dex.owner()).to.equal(owner.address);
    });

    it("Traders should have 1 million tokens", async function () {
      const {
        token,
        traderOne,
        traderTwo,
        traderThree,
        traderFour,
      } = await loadFixture(deployPerpetualDexFixture);

      const amount = ethers.parseEther("1000000");

      expect(await token.balanceOf(traderOne.address)).to.equal(amount);
      expect(await token.balanceOf(traderTwo.address)).to.equal(amount);
      expect(await token.balanceOf(traderThree.address)).to.equal(amount);
      expect(await token.balanceOf(traderFour.address)).to.equal(amount);
    });
  });

  describe("deposit()", function () {
    it("Should deposit tokens", async function () {
      const { dex, traderOne } = await loadFixture(deployPerpetualDexFixture);

      const amount = 1000;

      const tx = await dex.connect(traderOne).deposit(amount);
      await tx.wait();

      expect(await dex.balanceOf(traderOne.address)).to.equal(amount);
    });

    it("Should emit Deposit event", async function () {
      const { dex, traderOne } = await loadFixture(deployPerpetualDexFixture);

      const amount = 1000;

      await expect(dex.connect(traderOne).deposit(amount))
        .to.emit(dex, "Deposit")
        .withArgs(traderOne.address, amount);
    });

    it("Should revert if amount is zero", async function () {
      const { dex } = await loadFixture(deployPerpetualDexFixture);

      await expect(dex.deposit(0)).to.be.revertedWith(
        "Amount must be greater than 0"
      );
    });
  });

  describe("withdraw()", function () {
    it("Should Withdraw tokens", async function () {
      const { dex, traderOne } = await loadFixture(deployPerpetualDexFixture);

      const amount = 1000;
      const depositAmount = 1500;

      const depositTx = await dex.connect(traderOne).deposit(depositAmount);
      await depositTx.wait();

      const tx = await dex.connect(traderOne).withdraw(amount);
      await tx.wait();

      expect(await dex.balanceOf(traderOne.address)).to.equal(
        depositAmount - amount
      );
    });

    it("Should emit Withdraw event", async function () {
      const { dex, traderOne } = await loadFixture(deployPerpetualDexFixture);

      const amount = 1000;

      const depositTx = await dex.connect(traderOne).deposit(amount);
      await depositTx.wait();

      await expect(dex.connect(traderOne).withdraw(amount))
        .to.emit(dex, "Withdraw")
        .withArgs(traderOne.address, amount);
    });

    it("Should revert if amount is zero", async function () {
      const { dex } = await loadFixture(deployPerpetualDexFixture);

      await expect(dex.withdraw(0)).to.be.revertedWith(
        "Amount must be greater than 0"
      );
    });

    it("Should revert if amount is greater than balance", async function () {
      const { dex, traderOne } = await loadFixture(deployPerpetualDexFixture);

      const amount = 10000;
      const depositAmount = 1000;

      const depositTx = await dex.connect(traderOne).deposit(depositAmount);
      await depositTx.wait();

      await expect(dex.connect(traderOne).withdraw(amount)).to.be.revertedWith(
        "Insufficient balance"
      );
    });
  });

  describe("openPosition()", function () {
    it("Should revert if deposited amount is zero", async function () {
      const { dex, traderOne } = await loadFixture(deployPerpetualDexFixture);

      const amount = 0;
      const positionType = PositionType.Long;
      const leverage = 5;
      const depositAmount = 1000;

      const depositTx = await dex.connect(traderOne).deposit(depositAmount);
      await depositTx.wait();

      await expect(
        dex.connect(traderOne).openPosition(amount, positionType, leverage)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should revert if leverage is zero", async function () {
      const { dex, traderOne } = await loadFixture(deployPerpetualDexFixture);

      const amount = 1000;
      const positionType = PositionType.Long;
      const leverage = 0;

      const depositTx = await dex.connect(traderOne).deposit(amount);
      await depositTx.wait();

      await expect(
        dex.connect(traderOne).openPosition(amount, positionType, leverage)
      ).to.be.revertedWith("Leverage must be greater than 0");
    });

    it("Should revert if amount is greater than balance", async function () {
      const { dex, traderOne } = await loadFixture(deployPerpetualDexFixture);

      const amount = 10000;
      const positionType = PositionType.Long;
      const leverage = 5;

      const depositTx = await dex.connect(traderOne).deposit(amount - 1000);
      await depositTx.wait();

      await expect(
        dex.connect(traderOne).openPosition(amount, positionType, leverage)
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should revert if position type is not Long or Short", async function () {
      const { dex, traderOne } = await loadFixture(deployPerpetualDexFixture);

      const amount = 1000;
      const positionType = 2; // Unknown
      const leverage = 5;

      const depositTx = await dex.connect(traderOne).deposit(amount);
      await depositTx.wait();

      await expect(
        dex.connect(traderOne).openPosition(amount, positionType, leverage)
      ).to.be.revertedWithoutReason();
    });

    it("Should open a long position", async function () {
      const { dex, traderOne } = await loadFixture(deployPerpetualDexFixture);

      const amount = 1000;
      const positionType = PositionType.Long;
      const leverage = 5;

      const depositTx = await dex.connect(traderOne).deposit(amount);
      await depositTx.wait();

      const tx = await dex
        .connect(traderOne)
        .openPosition(amount, positionType, leverage);
      await tx.wait();

      expect(await dex.balanceOf(traderOne.address)).to.equal(0);

      const position = await dex.getCurrentPosition(traderOne.address);

      expect(position[0]).to.equal(amount);
      expect(position[1]).to.equal(positionType);
      expect(position[2]).to.equal(leverage);
    });

    it("Should open a short position", async function () {
      const { dex, traderOne } = await loadFixture(deployPerpetualDexFixture);

      const amount = 1000;
      const positionType = PositionType.Short; // Short
      const leverage = 5;

      const depositTx = await dex.connect(traderOne).deposit(amount);
      await depositTx.wait();

      const tx = await dex
        .connect(traderOne)
        .openPosition(amount, positionType, leverage);
      await tx.wait();

      expect(await dex.balanceOf(traderOne.address)).to.equal(0);

      const position = await dex.getCurrentPosition(traderOne.address);

      expect(position[0]).to.equal(amount);
      expect(position[1]).to.equal(positionType);
      expect(position[2]).to.equal(leverage);
    });

    it("Should emit PositionOpened event", async function () {
      const { dex, traderOne } = await loadFixture(deployPerpetualDexFixture);

      const amount = 1000;
      const positionType = PositionType.Long;
      const leverage = 5;

      const depositTx = await dex.connect(traderOne).deposit(amount);
      await depositTx.wait();

      await expect(
        dex.connect(traderOne).openPosition(amount, positionType, leverage)
      )
        .to.emit(dex, "PositionOpened")
        .withArgs(traderOne.address, amount, positionType, leverage);
    });

    it("Should revert if trader has an open position", async function () {
      const { dex, traderOne } = await loadFixture(deployPerpetualDexFixture);

      const amount = 1000;
      const positionType = PositionType.Long;
      const leverage = 5;

      const depositTx = await dex.connect(traderOne).deposit(amount);
      await depositTx.wait();

      const tx = await dex
        .connect(traderOne)
        .openPosition(amount / 2, positionType, leverage);
      await tx.wait();

      await expect(
        dex.connect(traderOne).openPosition(amount / 2, positionType, leverage)
      ).to.be.revertedWith("Position already open");
    });
  });

  describe("increasePosition()", function () {
    const positionAmount = 1000;
    const positionType = PositionType.Long;
    const leverage = 5;
    const depositAmount = 2000;

    let fixtureData: FixtureData;

    beforeEach(async function () {
      fixtureData = await loadFixture(deployPerpetualDexFixture);

      const { dex, traderOne } = fixtureData;

      const depositTx = await dex.connect(traderOne).deposit(depositAmount);
      await depositTx.wait();

      const tx = await dex
        .connect(traderOne)
        .openPosition(positionAmount, positionType, leverage);
      await tx.wait();
    });

    it("Should revert if deposited amount is zero", async function () {
      const { dex, traderOne } = fixtureData;

      await expect(
        dex.connect(traderOne).increasePosition(0)
      ).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should revert if amount is greater than balance", async function () {
      const { dex, traderOne } = fixtureData;

      const amount = 2500;

      await expect(
        dex.connect(traderOne).increasePosition(amount)
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should increase a long position", async function () {
      const { dex, traderOne } = fixtureData;

      const increaseAmount = 500;

      const increaseTx = await dex
        .connect(traderOne)
        .increasePosition(increaseAmount);
      await increaseTx.wait();

      const traderOneAddress = await traderOne.getAddress();

      const expectedDepositedAmount =
        depositAmount - positionAmount - increaseAmount;

      expect(await dex.balanceOf(traderOneAddress)).to.equal(
        expectedDepositedAmount
      );

      const position = await dex.getCurrentPosition(traderOneAddress);

      expect(position[0]).to.equal(positionAmount + increaseAmount);
      expect(position[1]).to.equal(positionType);
      expect(position[2]).to.equal(leverage);
    });

    it("Should increase a short position", async function () {
      const { dex, traderOne } = await loadFixture(deployPerpetualDexFixture);

      const amount = 500;
      const positionType = PositionType.Short; // Short
      const leverage = 5;
      const depositAmount = 1500;

      const depositTx = await dex.connect(traderOne).deposit(depositAmount);
      await depositTx.wait();

      const tx = await dex
        .connect(traderOne)
        .openPosition(amount, positionType, leverage);
      await tx.wait();

      const increaseAmount = 500;

      const increaseTx = await dex
        .connect(traderOne)
        .increasePosition(increaseAmount);
      await increaseTx.wait();

      expect(await dex.balanceOf(traderOne.address)).to.equal(
        depositAmount - amount - increaseAmount
      );

      const position = await dex.getCurrentPosition(traderOne.address);

      expect(position[0]).to.equal(amount + increaseAmount);
      expect(position[1]).to.equal(positionType);
      expect(position[2]).to.equal(leverage);
    });

    it("Should emit PositionIncreased event", async function () {
      const { dex, traderOne } = fixtureData;

      const increaseAmount = 500;

      const traderOneAddress = await traderOne.getAddress();

      await expect(dex.connect(traderOne).increasePosition(increaseAmount))
        .to.emit(dex, "PositionIncreased")
        .withArgs(traderOneAddress, increaseAmount);
    });
  });

  describe("closePosition()", function () {
    const positionAmount = 1000;
    const positionType = PositionType.Long;
    const leverage = 5;
    const depositAmount = 2000;

    let fixtureData: FixtureData;

    beforeEach(async function () {
      fixtureData = await loadFixture(deployPerpetualDexFixture);

      const { dex, traderOne } = fixtureData;

      const depositTx = await dex.connect(traderOne).deposit(depositAmount);
      await depositTx.wait();

      const tx = await dex
        .connect(traderOne)
        .openPosition(positionAmount, positionType, leverage);
      await tx.wait();
    });

    it("Should revert if close amount is 0", async function () {
      const { dex, traderOne } = fixtureData;

      await expect(dex.connect(traderOne).closePosition(0)).to.be.revertedWith(
        "Amount must be greater than 0"
      );
    });

    it("Should revert if no position open", async function () {
      const { dex, traderTwo } = fixtureData;

      await expect(
        dex.connect(traderTwo).closePosition(1000)
      ).to.be.revertedWith("No position open");
    });

    it("Should revert if close amount is greater than position amount", async function () {
      const { dex, traderOne } = fixtureData;

      await expect(
        dex.connect(traderOne).closePosition(positionAmount + 1000)
      ).to.be.revertedWith("Insufficient balance");
    });

    it("Should close a position completely", async function () {
      const { dex, traderOne } = fixtureData;

      const closeAmount = positionAmount;
      const traderOneAddress = await traderOne.getAddress();

      const closeTx = await dex.connect(traderOne).closePosition(closeAmount);
      await closeTx.wait();

      const position = await dex.getCurrentPosition(traderOneAddress);

      expect(position[0]).to.equal(0);
    });

    it("Should close a position partially", async function () {
      const { dex, traderOne } = fixtureData;

      const closeAmount = positionAmount / 2;
      const traderOneAddress = await traderOne.getAddress();

      const initialBalance = await dex.balanceOf(traderOneAddress);

      const closeTx = await dex.connect(traderOne).closePosition(closeAmount);
      await closeTx.wait();

      const currentPosition = await dex.getCurrentPosition(traderOneAddress);

      const formattedCurrentPosition = formatPosition(
        currentPosition[0],
        (currentPosition[1] as unknown) as PositionType,
        currentPosition[2]
      );

      expect(await dex.balanceOf(traderOneAddress)).to.equal(
        initialBalance + ethers.toBigInt(closeAmount)
      );

      expect(formattedCurrentPosition.amount).to.equal(
        positionAmount - closeAmount
      );
      expect(formattedCurrentPosition.position).to.equal(positionType);
      expect(formattedCurrentPosition.leverage).to.equal(leverage);
    });
  });
});
